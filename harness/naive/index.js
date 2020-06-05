#! /usr/bin/env node
const path = require('path');
const fs = require('fs-extra');
const yargs = require('yargs');
const chalk = require('chalk');
const Connector = require('infra.connectors');
const cheerio = require('cheerio');
const got = require('got');
const csv = require("csv-parse")
const vbox = require('./lib/virtualbox');
const TUTDIR = path.resolve(__dirname, '../../tutorials/naive');
const TIMEOUT = 600000; // ms

(async () => {

    yargs.command('test', 'execute tutorials', (yargs) => { }, async (argv) => {
        let csvJSON = await parseCSV(path.resolve(TUTDIR, 'tutorials.csv'));

        await fs.ensureDir(path.resolve('./logs'));

        for (const tutorial of csvJSON) {
            if (!await fs.pathExists(path.resolve(`./logs/${tutorial.id}_${tutorial.source}.log`)) && tutorial.os != 'ubuntu15' && tutorial.os != 'ubuntu17') {
                // skip running if log already exists:
                // if (!await fs.pathExists(path.resolve(`./logs/${tutorial.id}_${tutorial.source}.log`))) {
                try {
                    console.log(tutorial.links);
                    let sshConfig = await vboxInfra(tutorial.id, tutorial.os, tutorial.source);
                    let conn = Connector.getConnector('ssh', `${sshConfig.user}@${sshConfig.hostname}:${sshConfig.port}`, { privateKey: path.resolve('./lib/resources/id_rsa') });
                    await conn.ready();

                    console.log('==> extracting snippets from tutorial...');
                    const snippets = await getSnippets(tutorial.links, tutorial.source);

                    console.log('==> running snippets...');
                    for (const snippetObj of snippets) {
                        // supply a default user input of "yes" for any command (use --optionyes)
                        if(argv.optionyes) {
                            let lines = snippetObj.snippet.trim().split('\n');
                            let linesFixed = [];
                            for (let index = 0; index < lines.length; index++) {
                                if(lines[index].slice(-1) == '\\') {
                                    index++;
                                    linesFixed[index - 1] += lines[index];
                                } else {
                                    linesFixed.push(lines[index]);
                                }
                            }
                            
                            lines = '';
                            for (let line of linesFixed) {
                                if (line.match(/sudo\s+apt\s+/g) != null && line.match(/sudo\s+apt\s+-y/g) == null) {
                                    console.log('==> adding yes to apt/apt-get commands');
                                    line += line.replace(/apt /g, 'apt -y ') + '\n';
                                } 

                                else if (line.match(/sudo\s+apt-get\s+/g) != null && line.match(/sudo\s+apt-get\s+-y/g) == null) {
                                    console.log('==> adding yes to apt/apt-get commands');                                    
                                    lines += line.replace(/apt-get /g, 'apt-get -y ') + '\n';
                                }

                                else {
                                    lines += line + '\n';
                                }
                                
                            }

                            snippetObj.snippet = lines;
                        }

                        console.log('==================');
                        console.log(chalk.gray('$ ' + snippetObj.snippet));
                        let output;

                        try {
                            // saving a little time. We already know this will timeout
                            if (snippetObj.snippet.match(/apt-get\s+install/) || snippetObj.snippet.match(/apt\s+install/)) {
                                if (!snippetObj.snippet.includes('-y') && !argv.repair && !argv.optionyes) 
                                    throw `"timed out"`;
                            }
                            output = await promiseTimeout(TIMEOUT, conn.exec(snippetObj.snippet));
                        } catch (err) {
                            console.error(err, 'skipping rest of tutorial...');
                            await log(tutorial.id, tutorial.source, { cmd: snippetObj.snippet, exitCode: 'timeout' });
                            break;
                        }

                        let failed = output.exitCode == 0 ? 'green' : 'red';
                        console.log(chalk`{${failed} ${JSON.stringify(output)}}\n`);
                        await log(tutorial.id, tutorial.source, { cmd: snippetObj.snippet, ...output });
                    }

                    await vboxInfra(tutorial.id, tutorial.os, tutorial.source, true);
                } catch (error) {
                    console.log(error);
                }
            }
        }
    });

    yargs.command('stats <logDirectory>', 'calculate stats of passing/failing', (yargs) => { }, async (argv) => {
        const csvJSON = await parseCSV(path.resolve(TUTDIR, 'tutorials.csv'));
        const logDir = path.resolve(argv.logDirectory);
        const logs = (await fs.readdir(logDir)).filter(log => log.includes('.log')).map(log => log.replace('.log', ''));

        let totalTutorials = 0;
        let timedoutTutorials = 0;

        for (const tutorial of csvJSON) {
            if(!logs.includes(`${tutorial.id}_${tutorial.source}`)) continue;
            let log = `${tutorial.id}_${tutorial.source}`;

            totalTutorials++;

            let timedout = false;

            console.log('===>log:', log);
            const logRows = (await fs.readFile(path.join(logDir, log + '.log'), { encoding: 'utf8' })).trim().split('\n').filter(line => line != '').map(row => JSON.parse(row.replace(/\n/g, "\\n").replace(/\t/g, "\\t")));

            let $ = cheerio.load(await fs.readFile(path.join(TUTDIR, '/html/', `${tutorial.id}_${tutorial.os == '?' ? '.' : tutorial.os}_${tutorial.source}.html`), {encoding: 'utf8'}));
            const snippetAvailable = await getSnippets(undefined, tutorial.source, false, $);

            if (logRows[logRows.length - 1].exitCode === 'timeout') {
                timedout = true;
                timedoutTutorials++;
            }

            let ranCommands = logRows.length;
            let passingCommands = logRows.filter(row => row.exitCode == 0 || row.exit_code == 0).length;

            // timeout
            // ranCommands
            // passingCommands
            // availableCOmmands
            await fs.appendFile(path.resolve(argv.logDirectory, 'stats.csv'), `'${tutorial.id}','${tutorial.source}','${timedout}','${ranCommands}','${passingCommands}','${snippetAvailable.length}','${JSON.stringify(logRows[logRows.length - 1])}'\n`);
        }

        console.log('% tutorials timed out:', timedoutTutorials / totalTutorials);
    });

    yargs.help().argv;
})();

async function getSnippets(tutorialLink, source, splitlines = false, $) {
    const response = tutorialLink && await got(tutorialLink);
    $ = $ || cheerio.load(response.body);

    let snippets = [];

    if (source === 'do') {
        $('pre.code-pre').each(async (i, e) => {
            let type = 'content';
            if ($(e).hasClass('command'))
                type = 'command';
            snippets[i] = { type, snippet: $(e).text() };
        });
    }
    else if (source === 'vultr') {
        $('pre>code').each(async (i, e) => {
            snippets[i] = { type: 'command', snippet: $(e).text() };
        })
    }
    else if (source === 'linuxize') {
        $('pre>code').each(async (i, e) => {
            let type = 'content';
            if ($(e).hasClass('language-console-bash')) {
                type = 'command';
            }
            snippets[i] = { type, snippet: $(e).text() };
        })
    }

    let FinalizedSnippets = [];
    if(splitlines) {
        for (let snippet of snippets) {
            snippet.snippet = snippet.snippet.replace(/\\\n/g, "");
            for (let line of snippet.snippet.trim().split(/\n/g)) {
                FinalizedSnippets.push({ type: snippet.type, snippet: line });
            }
        }
    } else {
        FinalizedSnippets = snippets;
    }

    return FinalizedSnippets;
}

async function vboxInfra(name, os, source, del = false) {
    name = `${name}-${source}-tutorial`;
    const infra = new vbox(os);
    if (del) return infra.delete(name);
    else return infra.create(name, {mem: 4096, cpus: 2});
}

// https://italonascimento.github.io/applying-a-timeout-to-your-promises/
function promiseTimeout(ms, promise) {
    // Create a promise that rejects in <ms> milliseconds
    let timeout = new Promise((resolve, reject) => {
        let id = setTimeout(() => {
            clearTimeout(id);
            reject('Timed out in ' + ms + 'ms.');
        }, ms)
    })

    // Returns a race between our timeout and the passed in promise
    return Promise.race([
        promise,
        timeout
    ])
}

async function parseCSV(path) {
    const links = await fs.readFile(path, { encoding: 'utf8' });

    return new Promise((resolve, reject) => {
        csv(links.trim(), {
            columns: true
        }, function (err, records) {
            if (err) reject(err);
            resolve(records);
        });
    });
}

async function log(tutorialID, tutorialSource, log) {
    await fs.appendFile(path.resolve(`./logs/${tutorialID}_${tutorialSource}.log`), JSON.stringify(log) + '\n', { encoding: 'utf8' });
}
