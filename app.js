'use strict';
const _ = require('lodash');
const express = require('express');
const app = express();
const addRequestId = require('express-request-id')();
const pLimit = require('p-limit')
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
const cache = null; // require('./caches/hbase'); // Could be null if no cache is needed
// const blastColumns = ['query id', 'subject id', '% identity', 'alignment length', 'mismatches', 'gap opens', 'q. start', 'q. end', 's. start', 's. end', 'evalue', 'bit score'];
const blastColumns = ['subject id', '% identity', 'alignment length', 'evalue', 'bit score', 'query sequence', 'subject sequence', 'qstart', 'qend', 'sstart', 'send', '% query cover'];
const blastQueue = require('./blastQueue')
const limit = pLimit(config.CACHE_CONCURRENCY);

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
    } else if(cache && !_.isArray(sequence)){
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

const getCachedResults = async ({seq, resultArray, marker}) => {
    try {

    const input = seq.map((e, idx) =>  limit(
       () =>  cache.get(seq[idx], config.DATABASE_NAME[marker], true )
        .then(
            (result)=> {
              // console.log("Cache hit")
               resultArray[idx] = result
            })
        .catch(() => {
           // console.log("Not cached")
        })
     ) )
    
    await Promise.allSettled(input)
    return resultArray;
    } catch (error) {
        console.log(error)
    }
    
}

const blastMany = async (req, res) => {
    const options = blastOptionsFromRequest(req)
    if(!_.isArray(options.seq)){
        return res.status(400)
    };
    const resultArray = Array(options.seq.length);

    options.resultArray = resultArray;

    if(cache){
        try {
            await getCachedResults(options)
        } catch (error) {
            console.log(error)
        }
        
    }
    // get array of indices where uncached data are
    const unCached = options.seq.map((e, i) => {
        return !!resultArray[i] ?  -1: i
    }).filter(e => e > -1)

    try {
        blastQueue.push(options, function(err, blastCliOutput) {
            if (err) {
                console.log(err);
                res.status(500).send(err);
            } else {
               // console.log(blastCliOutput)
                let blastJson = blastResultToJson(blastCliOutput);
                const grouped = _.groupBy(blastJson, "query id")

                for(let idx = 0; idx < options.seq.length; idx++){
                    const match = !!grouped[idx] ? getMatch(grouped[idx], options.marker, req.query.verbose) : {matchType: 'BLAST_NO_MATCH'}
                    resultArray[idx] = match

                }
                
                 if(cache && unCached.length > 0){
                    const promises = unCached.map((i) => limit(() => cache.set(options.seq[i], config.DATABASE_NAME[options.marker] , resultArray[i])
                    /*  .then(()=> {
                        console.log(`Inserted ${options.seq[i]} to cache successfully` )
                    }) */ 
                    .catch((err) => {
                        console.log("Caching err :")
                        console.log(err)
                    })))

                 } 
                 res.status(200).send(resultArray)
                
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

app.post('/blast/batch', blastMany);


app.post('/blast/raw',blastOneRaw );
app.get('/blast/raw',blastOneRaw );
app.post('/blast/cache', getFromCache);
app.get('/blast/cache', getFromCache);

app.listen(config.EXPRESS_PORT, function() {
    console.log('Express server listening on port ' + config.EXPRESS_PORT);
    console.log('Available databases: ')
    Object.keys(config.DATABASE_NAME).map(marker => console.log(`${marker}: ${config.DATABASE_NAME[marker]}`))
 });
