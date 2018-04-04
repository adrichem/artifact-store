('use strict');
const express = require('express');
const multer = require('multer');
const MulterAzureStorage = require('multer-azure-storage');
const request = require('request');
const yargs = require('yargs');

function printUsage() {
    console.log('Usage');
    console.log('--port nn --connection url --key str --account str [--container str] [--metadataContainer str]  [--metadataUrl] [--indexer url]');
    console.log('Example:');
    console.log('--port 80 --connection https://myartifacts.blob.core.windows.net/ --key O+...Q= --account mystorageaccount --indexer http://elasticsearch:9292/artifacts');
}

const args = yargs.argv;

if (undefined === args.port || undefined === args.connection || undefined === args.key || undefined === args.account) {
    printUsage();
    throw new Error('Incorrect parameters');
}

if (undefined === args.container) {
    args.container = 'artifacts';
}

if (undefined === args.metadataContainer) {
    args.metadataContainer = 'metadata';
}

if (undefined === args.metadataUrl) {
    args.metadataUrl = 'http://127.0.0.1:' + args.port + '/metadata';
}


const artifactBlobStorage = multer({
    storage: new MulterAzureStorage({
        azureStorageConnectionString: args.connection,
        azureStorageAccessKey: args.key,
        azureStorageAccount: args.account,
        containerName: args.container,
    })
});

const metadataBlobStorage = multer({
    storage: new MulterAzureStorage({
        azureStorageConnectionString: args.connection,
        azureStorageAccessKey: args.key,
        azureStorageAccount: args.account,
        containerName: args.metadataContainer,
    })
});


const app = express();

app.post('/metadata', metadataBlobStorage.single('metadata'), (req, res) => {
    //Multer already stored this metadata file in blobstorage
    res.status(200).send('');

    //Download and send metadata to indexer
    if (undefined !== args.indexer) {
        var indexer = {
            url: args.indexer,
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
        };

        var source = {
            url: req.file.url,
            method: 'GET',
        };
        request(source).pipe(request(indexer)).on('response', resIndexer => {
            if (resIndexer.statusCode >= 300) {
                console.log(resIndexer.statusCode);
            }
        });
    }
});

app.post('/', artifactBlobStorage.any(), (req, res) => {
    // Multer has stored the artifact files on blob storage, lets handle the metadata of each blob
    let DefaultErrorText = '';
    console.log(req.files);
    if (undefined === req.files) {
        res.status(400).send(DefaultErrorText);
        return;
    }

    let userMetaData;
    if (undefined !== req.body.metadata) {
        try {
            userMetaData = JSON.parse(req.body.metadata);
        } catch (error) {
            res.status(400).send(DefaultErrorText);
            return;
        }
    }

    res.status(200).send('');

    //Save meta data for each file
    for (var i = 0; i < req.files.length; i++) {
        let SingleBlobMetadata = {
            url: req.files[i].url,
            originalname: req.files[i].originalname,
            mimetype: req.files[i].mimetype,
            metadata: userMetaData,
        };

        //Send meta data of this blob to be stored somewhere
        var metadataRequest = request.post(args.metadataUrl, err => { if (err) console.log('Error sending metadata!' + err); });
        var form = metadataRequest.form();
        form.append('metadata', JSON.stringify(SingleBlobMetadata), {
            filename: 'metadata.json',
            contentType: 'application/json'
        });

    }
    console.log(userMetaData);
});

app.listen(args.port, () => console.log(args));
