# Execution Harness

This directory contains the execution harness for both naive and Docable approaches. To get started, ensure you have install the dependencies listed below:


## Install Prerequisite

- Our testing harness is written using [Node.js](https://nodejs.org/en/). Please refer to Node.js [official installation instructions for your operating system](https://nodejs.org/en/download/package-manager/).

- Out testing harness uses [VirtualBox](https://www.virtualbox.org/) to provision computing environments (virtual machines). Simply download the executable installer for your operating system [on this page](https://www.virtualbox.org/wiki/Downloads), and run it to install VirtualBox.

    > _Note: you need to make sure hardware virtualization (Intel VT-x or AMD SVM) support is enabled on your system before using virtualbox._

- Our scripts use several npm package for harness implementation which need to be installed before they can run. This can be done by running `npm install` command in the current directory (`./harness`).

## Execution

After successfully installing the dependencies above, go to [`./harness/docable`](./docable) or [`./harness/naive`](./naive) and follow corresponding instructions for using each of the scripts. 
