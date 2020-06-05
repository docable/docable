#! /usr/bin/env node
const path = require('path');
const fs = require('fs-extra');
const yargs = require('yargs');
const Connector = require('infra.connectors');
const vbox = require('./lib/virtualbox');
const testreport = require('../node_modules/docable');
const TIMEOUT = 600000; // ms
const TUTDIR = path.resolve(__dirname, '../../tutorials/docable');
const ANNOTATIONDIR = path.resolve(__dirname, '../../annotations');

(async () => {

    let stepsFiles = (await fs.readdir(ANNOTATIONDIR)).filter(f => f.endsWith('.yml'));
    for (const stepsFile of stepsFiles) {
        let [id, os, source] = stepsFile.replace('.yml', '').split('_');

        // skip if we already have the logs
        if (await fs.pathExists(path.resolve(TUTDIR, `steps/docable_results/${id}_${os}_${source}.html.html`))) continue;

        let options = {
            textSelector: source === 'do' ? 'pre.code-pre' : source === 'vultr' ? 'pre' : 'div.highlight',
            css: {
                passing: '.passing { background-color: #e6ffe6 !important }',
                failing: '.failing { background-color: #ffe6e6 !important }'
            }
        };

        // provision VM
        let sshConfig = await vboxInfra(id, os, source);
        let conn = Connector.getConnector('ssh', `${sshConfig.user}@${sshConfig.hostname}:${sshConfig.port}`, { privateKey: path.resolve('./lib/resources/id_rsa') });
        await conn.ready();

        // installing expect and deleting apt cache to avoid side effects of modifying a clean VM base image
        await conn.exec(`sudo apt-get update && sudo apt-get install -y expect && sudo rm -r /var/lib/apt/lists/*`);

        // update ssh config in "steps.yml" files to use a new VM
        const stepsFilePath = path.resolve(ANNOTATIONDIR, stepsFile);
        let steps = await fs.readFile(stepsFilePath, { encoding: 'utf8' });
        steps = steps.replace(/vagrant@127.0.0.1:[0-9]{4}/, `${sshConfig.user}@${sshConfig.hostname}:${sshConfig.port}`);
        await fs.writeFile(stepsFilePath, steps, { encoding: 'utf8' });
        
        // run docable
        try {
            await promiseTimeout(TIMEOUT, testreport("report", { stepfile: stepsFilePath }, options));
        } catch (err) {
            console.error(err, 'skipping rest of tutorial...');
        }
        await vboxInfra(id, os, source, true);
    }

    yargs.help().argv;

})();

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
            reject('Timed out in ' + ms + 'ms.')
        }, ms)
    })

    // Returns a race between our timeout and the passed in promise
    return Promise.race([
        promise,
        timeout
    ])
}
