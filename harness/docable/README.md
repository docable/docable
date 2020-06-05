# Docable Execution Harness

This directory contains the Docable execution harness scripts.

### Prerequisits

- Node.js
- VirtualBox
- Execution harness npm dependencies

Before starting here, you should follow the steps in "Install Prerequisite" section of previous directory ([`./harness`](./harness)) to install VirtualBox, Node.js and the npm dependencies.

### Overview

Docable uses annotations in `steps.yml` files (_section 2.5.2 in paper_) that contains human annotations to execute tutorials on a given computing environment (virtual machine). These annotation files for the sample of 40 tutorials that was used in the paper are available in [`../../annotations`](../../annotations). And the virtual machines needed for execution of tutorials are automatically provisioned as part of this execution harness.

### Execution

Simply run the command below, to run all of the [40 annotation files](../../annotations):

```bash
node index.js
```

You will see the execution harness pulls a base image for the corresponding VM image, provision a VM using that image, and start executing the annotations. Results of annotations are then stored in Docable feedback files (ex. Figure 4 in the paper) which are created in a new directory called `docable_results` in the same directory as annotations (`./annotations/docable_results`).
