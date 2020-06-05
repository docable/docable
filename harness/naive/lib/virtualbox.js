const fs = require('fs-extra');
const path = require('path');
const vbox = require('node-virtualbox');
const VBoxProvider = require('node-virtualbox/lib/VBoxProvider');
const privateKey = path.resolve(__dirname, './resources/id_rsa');
const imagesUtil = require('./images');

class VirtualBox {
    constructor(image) {
        this.defaultOptions =
            {
                cpus: 1,
                mem: 1024,
                syncs: [],
                disk: true,
                verbose: true,
                ssh_port: undefined // auto-find a ssh available port
            }

        this.image = image;
        this.driver = new VBoxProvider();
        this.privateKey = privateKey
    }

    /**
     * Returns State of a VM
     * @param {String} VMName
     */
    async getState(VMName) {
        let vmInfo = await this.driver.info(VMName);
        return vmInfo.VMState.replace(/"/g, '');
    }

    async _getUsedPorts(name) {
        let ports = [];
        let properties = await this.driver.info(name);
        for (let prop in properties) {
            if (prop.indexOf('Forwarding(') >= 0) {
                try {
                    ports.push(parseInt(properties[prop].split(',')[3]));
                }
                catch (e) { console.error(e); }
            }
        }
        return ports;
    }

    /**
     * Get ssh configurations
     * @param {Obj} machine
     * @param {Obj} nodeName Optionally give name of machine when multiple machines declared.
     */
    async getSSHConfig(machine, nodeName) {

        // Use VirtualBox driver
        let vmInfo = await this.driver.info(machine);
        let port = null;
        Object.keys(vmInfo).forEach(key => {
            if (vmInfo[key].includes('ssh')) {
                port = parseInt(vmInfo[key].split(',')[3]);
            }
        });
        return { user: 'vagrant', port: port, host: machine, hostname: '127.0.0.1', private_key: this.privateKey };
    }

    async pullImg(image) {
        try {
            return imagesUtil.pullImg(image);
        } catch (err) {
            console.log('==> err', err);
        }
    }

    async create(name, options) {
        let args = {
            vmname: name,
            provision: true,
            ovf: await this.pullImg(this.image),
            cpus: options.cpus || this.defaultOptions.cpus,
            mem: options.mem || this.defaultOptions.mem,
            syncs: options.syncs || this.defaultOptions.syncs,
            disk: options.disk || this.defaultOptions.disk,
            verbose: options.verbose || this.defaultOptions.verbose,
            add_ssh_key: path.resolve(__dirname, './resources/id_rsa.pub'),
            ssh_port: await require('node-virtualbox/lib/util').findAvailablePort(this.driver),
        };

        if ((await this.driver.list()).filter(e => e.name === name).length == 0) {
            await vbox(args);
        } else if ((await this.getState(name)) != 'running') {
            await vbox({ start: true, vmname: name, syncs: [], verbose: true });
        }

        let sshInfo = await this.getSSHConfig(name);
        console.log(`ssh -i ${sshInfo.private_key} ${sshInfo.user}@${sshInfo.hostname} -p ${sshInfo.port} -o StrictHostKeyChecking=no`)

        return sshInfo;
    }

    async stop(name, force = false) {
        await vbox({ stopCmd: true, vmname: name, syncs: [], verbose: false }).catch(e => e);
    }

    async delete(name) {
        let state = await this.getState(name);
        if (state == 'running') {
            await this.stop(name);
        } else if (state === 'not_found') {
            throw new Error(`vm ${name} does not exist`);
        }
        await vbox({ deleteCmd: true, vmname: name, syncs: [], verbose: false }).catch(e => e);
    }

    async exists(name) {
        return (await this.driver.list()).map(vm => vm.name).includes(name);
    }

    async list() {
        return await this.driver.list();
    }
}

module.exports = VirtualBox;
