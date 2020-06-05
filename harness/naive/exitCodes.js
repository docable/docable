#! /usr/bin/env node
const path = require('path');
const fs = require('fs-extra');

const LOGDIR = path.resolve(__dirname, './logs');

(async () => {

    let experiments = ['naive_4gb_2core', 'naive++_y_4gb_2core'];
    
    for(let experiment of experiments) {
        let allExitCodes = {};
        let exitCodeCounter = 0;

        let logFiles = (await fs.readdir(path.resolve(LOGDIR, experiment))).filter(f => f.endsWith('.log'));
        for (const logFile of logFiles) {

            let logs = fs.readFileSync(path.resolve(LOGDIR, experiment, logFile), {encoding: 'utf8'}).split('\n');
            logs.splice(-1);
            logs = logs.map(log => JSON.parse(log));
            let exitCodes = logs.map(log => log.exitCode);

            for (let exitCode of new Set(exitCodes)) {
                if (allExitCodes[exitCode]) {
                    allExitCodes[exitCode] += exitCodes.filter(e => e == exitCode).length;
                } else {
                    allExitCodes[exitCode] = exitCodes.filter(e => e == exitCode).length;
                }
                
                exitCodeCounter += exitCodes.filter(e => e == exitCode).length;
            }
        }
        fs.writeFileSync(path.resolve(LOGDIR, experiment, 'exitCodes.json'), JSON.stringify(allExitCodes), {encoding: 'utf8'});
        console.log('count of exit codes in', experiment, ':',exitCodeCounter);
    }
})();
