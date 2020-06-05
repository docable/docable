# Naive Execution Harness

This directory contains the Naive and Naive++ execution harness scripts.

### Prerequisits

- Node.js
- VirtualBox
- Execution harness npm dependencies

Before starting here, you should follow the steps in "Install Prerequisite" section of previous directory ([`./harness`](./harness)) to install VirtualBox, Node.js and the npm dependencies.

### Execution

#### Naive

Run the command below, to run all of the [663 tutorials](../../tutorials/naive) using **Naive** approach:

```bash
node index.js test
```

#### Naive++

Run the command below, to run all of the [663 tutorials](../../tutorials/naive) using **Naive++** approach:

```bash
node index.js test --optionyes
```

You will see the execution harness pulls a base image for the corresponding VM image, provision a VM using that image, and start executing the code blocks of tutorials. Logs from execution from executions are stored in `./harness/naive/logs`. Make sure to move the logs to another directory before starting execution using a different approach, to avoid deleting old logs.

#### Summerized Stats

Run the command below to summerize stats from the log files into one csv file for easier processing:

```bash
node index.js stats logs
```

After running this command a file called `stats.csv` will be created in logs directory (`./harness/naive/logs/stats.csv`). This CSV file will be in this format:

```
tutorial_id, tutorial_source, timedout (true/false), ranCommands (count), passingCommands (count), snippetAvailable_length (count), log_from_last_executed_code_block
```
