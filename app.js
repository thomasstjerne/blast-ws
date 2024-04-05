'use strict';
const _ = require('lodash');
const express = require('express');
const app = express();
const addRequestId = require('express-request-id')();
const bodyParser = require('body-parser');
const {
    sanitizeSequence,
    simplyfyMatch,
    getMatch,
    blastResultToJson,
    blastOptionsFromRequest
} = require('./util')
// const spawn = require('child_process').spawn;
const config = require('./config');
// const async = require('async');
// const fs = require('fs');
const cache =  null;// require('./caches/hbase'); // Could be null if no cache is needed
// const blastColumns = ['query id', 'subject id', '% identity', 'alignment length', 'mismatches', 'gap opens', 'q. start', 'q. end', 's. start', 's. end', 'evalue', 'bit score'];
const blastColumns = ['subject id', '% identity', 'alignment length', 'evalue', 'bit score', 'query sequence', 'subject sequence', 'qstart', 'qend', 'sstart', 'send', '% query cover'];
const blastQueue = require('./blastQueue')

app.use(addRequestId);
app.use(bodyParser.json({
    limit: '1mb'
}));

app.use('/blast', function(req, res, next) {
    let marker = _.get(req, 'body.marker') ||  _.get(req, 'query.marker');
    let sequence = _.get(req, 'body.sequence') ||  _.get(req, 'query.sequence');
    if (!marker) {
        res.status(422).send({'error': 'No marker given'});
    } else if (config.SUPPORTED_MARKERS.indexOf(marker.substring(0, 3).toLowerCase()) === -1) {
        res.status(422).send({'error': 'Unsupported marker'});
    } else if (!sequence) {
        res.status(422).send({'error': 'No sequence given'});
    } else if(cache){
        const options = blastOptionsFromRequest(req);
        cache.get(options.seq, config.DATABASE_NAME[options.marker] )
                        .then(
                            (result)=> {
                               // console.log("fetched from cache")
                                res.status(200).send(result);
                            })
                        .catch(() => {
                            next() 
                        }) 
    } else {
        next();
    }
});

const blastOne = (req, res) => {
    const options = blastOptionsFromRequest(req)
    try {
        blastQueue.push(options, function(err, blastCliOutput) {
            if (err) {
                console.log(err);
                res.status(500).send(err);
            } else {
                let blastJson = blastResultToJson(blastCliOutput);
                let match = (blastJson.matchType !== 'BLAST_NO_MATCH') ? getMatch(blastJson, options.marker, req.query.verbose) : blastJson;
                match.sequenceLength = (options.seq) ? options.seq.length : 0;
                 // Only cache default results with max target seqs === config.MAX_TARGET_SEQS
                if(!cache || (options.max_target_seqs && options.max_target_seqs !== config.MAX_TARGET_SEQS)){
                    res.status(200).json(match);
                } else {
                        cache.set(options.seq, config.DATABASE_NAME[options.marker] , match)
                        .then(()=> {res.status(200).json(match);})
                        .catch((err) => {
                            console.log("Caching err :")
                            console.log(err)
                            res.status(200).json(match);
                        })       
                }
                
            }
        });
    } catch (err) {
        console.log(err);
    }
}

const blastOneRaw = (req, res) => {
    const options = blastOptionsFromRequest(req)
    try {
        blastQueue.push(options, function(err, blastCliOutput) {
            if (err) {
                console.log(err);
                res.status(500).send(err);
            } else {
                let match = blastResultToJson(blastCliOutput);
                match.sequenceLength = options.seq ? options.seq.length : 0;
                res.status(200).json(match);
            }
        });
    } catch (err) {
        console.log(err);
    }
}


function getFromCache(req, res) {
    const options = blastOptionsFromRequest(req)
        if(cache){
            cache.get(options.seq, config.DATABASE_NAME[options.marker] )
                        .then(
                            (result)=> {
                                res.status(200).send(result);
                            })
                        .catch((err) => {
                            res.sendStatus(404)
                        })    
        } else {
            res.sendStatus(404)
        }
}

app.post('/blast', blastOne);
app.get('/blast', blastOne);

app.post('/blast/raw',blastOneRaw );
app.get('/blast/raw',blastOneRaw );
app.post('/blast/cache', getFromCache);
app.get('/blast/cache', getFromCache);

app.listen(config.EXPRESS_PORT, function() {
    console.log('Express server listening on port ' + config.EXPRESS_PORT);
    console.log('Available databases: ')
    Object.keys(config.DATABASE_NAME).map(marker => console.log(`${marker}: ${config.DATABASE_NAME[marker]}`))
 });
