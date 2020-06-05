const download = require('download');
const path = require('path');
const fs = require('fs-extra');
const ProgressBar = require('progress');
const baseImagePath = path.resolve(__dirname, '../../baseImage')
const tar = require('tar');

const baseImages = {
    ubuntu14: 'https://cloud-images.ubuntu.com/vagrant/trusty/current/trusty-server-cloudimg-amd64-vagrant-disk1.box',
    ubuntu16: 'https://cloud-images.ubuntu.com/xenial/current/xenial-server-cloudimg-amd64-vagrant.box',
    ubuntu17: 'http://cloud-images-archive.ubuntu.com/releases/zesty/release-20171208/ubuntu-17.04-server-cloudimg-amd64-vagrant.box',
    ubuntu18: 'https://cloud-images.ubuntu.com/bionic/current/bionic-server-cloudimg-amd64-vagrant.box',
    centos: 'https://cloud.centos.org/centos/7/vagrant/x86_64/images/CentOS-7-x86_64-Vagrant-1905_01.VirtualBox.box'
}

async function pullImg(name) {
    if (!Object.keys(baseImages).includes(name)) {
        if (name === 'ubuntu' || name === '.') name = 'ubuntu16';
        else throw 'Image not found ...';
    }

    const destDir = path.resolve(baseImagePath, name);
    const destPath = path.resolve(destDir, path.basename(baseImages[name]))

    await fs.ensureDir(destDir);

    if (!(await fs.existsSync(path.join(destDir, 'box.ovf')))) {

        console.log(`no --ovf specified, downloading latest ${name} box!`);

        const bar = new ProgressBar('[:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: 0
        });

        // Download box
        await download(baseImages[name], destDir)
            .on('response', res => {
                bar.total = res.headers['content-length'];
                res.on('data', data => bar.tick(data.length));
            })
            .then(() => console.log('downloaded!'));

        // Extract box
        await tar.x({ file: destPath, C: destDir });

        // Remove unextracted .box file
        await fs.unlink(destPath);
    }

    return path.join(destDir, 'box.ovf');
}

module.exports = { pullImg };