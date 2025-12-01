'use strict';
const _ = require('lodash');
const express = require('express');
const app = express();
const addRequestId = require('express-request-id')();
const pLimit = require('p-limit')
const pQueue = require('p-queue').default;
const bodyParser = require('body-parser');
const {
    averageSeqLength,
    sanitizeSequence,
    simplyfyMatch,
    getMatch,
    blastResultToJson,
    blastOptionsFromRequest,
    chunkArray
} = require('./util')
// const spawn = require('child_process').spawn;
const config = require('./config');
// const async = require('async');
// const fs = require('fs');
const cache =  null// require('./caches/hbase'); // Could be null if no cache is needed
// const blastColumns = ['query id', 'subject id', '% identity', 'alignment length', 'mismatches', 'gap opens', 'q. start', 'q. end', 's. start', 's. end', 'evalue', 'bit score'];
const blastColumns = ['subject id', '% identity', 'alignment length', 'evalue', 'bit score', 'query sequence', 'subject sequence', 'qstart', 'qend', 'sstart', 'send', '% query cover'];
const runBlast = require('./blast')
const limit = pLimit(config.CACHE_CONCURRENCY);
const queue = new pQueue({ concurrency: config.NUM_CONCURRENT_PROCESSES });

app.use(addRequestId);
app.use(bodyParser.json({
    limit: '1mb'
}));

app.use('/blast', function(req, res, next) {
    let marker = _.get(req, 'body.marker') ||  _.get(req, 'query.marker');
    let sequence = _.get(req, 'body.sequence') ||  _.get(req, 'query.sequence');
    if (!marker) {
        res.status(422).send({'error': 'No marker given'});
    } else if (config.SUPPORTED_MARKERS.indexOf(marker.substring(0, 4).toLowerCase()) === -1) {
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

const blastOne = async (req, res) => {
    if(queue.size > 4 * config.NUM_CONCURRENT_PROCESSES){
        return res.status(503).send({error: 'Server busy, please try again later'});
    }
    const options = blastOptionsFromRequest(req)

    try {

        const blastCliOutput = await queue.add(() => runBlast(options));
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

  /*       blastQueue.push(options, function(err, blastCliOutput) {
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
        }); */
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
}

const blastOneRaw = async (req, res) => {
    if(queue.size > 4 * config.NUM_CONCURRENT_PROCESSES){
        return res.status(503).send({error: 'Server busy, please try again later'});
    }
    const options = blastOptionsFromRequest(req)
    try {
        const blastCliOutput = await queue.add(() => runBlast(options));
         let match = blastResultToJson(blastCliOutput);
                match.sequenceLength = options.seq ? options.seq.length : 0;
                res.status(200).json(match);

       /*  blastQueue.push(options, function(err, blastCliOutput) {
            if (err) {
                console.log(err);
                res.status(500).send(err);
            } else {
                let match = blastResultToJson(blastCliOutput);
                match.sequenceLength = options.seq ? options.seq.length : 0;
                res.status(200).json(match);
            }
        }); */
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
}

const getCachedResults = async ({seq, resultArray, marker}) => {
    try {

    const input = seq.map((e, idx) =>  limit(
       () =>  cache.get(seq[idx], config.DATABASE_NAME[marker] )
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

const blastChunk = async (options, verbose) => {

    let resultArray = Array(options.seq.length);
    const {marker} = options;

    if(cache){
        try {
            resultArray =  await getCachedResults({...options, resultArray: resultArray  })
            options.resultArray = resultArray;
        } catch (error) {
            console.log(error)
        }
        
    }
    /* console.log("resultArray")
    console.log(resultArray) */
    // get array of indices where uncached data are
    const unCached = options.seq.map((e, i) => {
        return !!resultArray[i] ?  -1: i
    }).filter(e => e > -1)



  

        try {
            if(cache && unCached.length === 0){
                return resultArray
            } else {
                // console.log(`Queue size: ${queue.size}  Pending: ${queue.pending}`)
                const blastCliOutput = await queue.add(() => runBlast(options));
                    
                       // console.log(blastCliOutput)
                        let blastJson = blastResultToJson(blastCliOutput);
                        const grouped = _.groupBy(blastJson, "query id")
        
                        
                        unCached.forEach(idx => {
                            const match = !!grouped[idx] ? getMatch(grouped[idx], marker, verbose) : {matchType: 'BLAST_NO_MATCH'}
                            resultArray[idx] = match
                        })
                        /* for(let idx = 0; idx < options.seq.length; idx++){
                            const match = !!grouped[idx] ? getMatch(grouped[idx], marker, verbose) : {matchType: 'BLAST_NO_MATCH'}
                            resultArray[idx] = match
        
                        } */
                        
                         if(cache && unCached.length > 0){
                            const promises = unCached.map((i) => limit(() => cache.set(options.seq[i], config.DATABASE_NAME[marker] , resultArray[i])
                              /* .then(()=> {
                                console.log(`Inserted ${options.seq[i]} to cache successfully` )
                            })  */
                            .catch((err) => {
                                console.log("Caching err :")
                                console.log(err)
                            })))
        
                         } 
                         return resultArray
                        
                    
                
            }
            
        } catch (err) {
            console.log(err);
            throw err;
        }

    }

const blastMany = async (req, res) => {

    if(queue.size > 4 * config.NUM_CONCURRENT_PROCESSES){
        return res.status(503).send({error: 'Server busy, please try again later'});
    }
    const options = blastOptionsFromRequest(req)
    if(!_.isArray(options.seq)){
        return res.status(400)
    };
    // Throw an error if more than 50 seqs are given
    if(options.seq.length > 25){
        // 413 Content Too Large
      return res.status(413)
    } 

    const controller = new AbortController();
    const signal = controller.signal; 

    res.on('close', () => {
        //console.log(`Request aborted by the client: ${req.id}`);
        controller.abort();
    });
   /*  if(queue.size > 8 * config.NUM_CONCURRENT_PROCESSES){
        return res.status(503).send({error: 'Server busy, please try again later'});
    } */

    try {
        
         
         const avgLength = averageSeqLength(options.seq);
        if(options?.marker === 'COI' && avgLength > 399){
            const chunks = chunkArray(options.seq, 5)
            const promises = chunks.map((chunk, idx) => blastChunk({...options, seq: chunk, filename: `${idx}_${options.filename}`, signal}, req.query.verbose))
            const results = await Promise.all(promises)
            const result = results.reduce((a, b) => [...a, ...b])
           // console.log(`Use chunks of 5`)
            res.status(200).send(result)
        } else {
            // console.log(`Don´t chunk`)
            const result = await blastChunk(options, req.query.verobose)
            res.status(200).send(result)
        } 
        
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
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
app.get('/queue-size', (req, res) => {
    res.status(200).send( {size: queue.size, pending: queue.pending} )
})

app.listen(config.EXPRESS_PORT, function() {
    console.log('Express server listening on port ' + config.EXPRESS_PORT);
    console.log('Available databases: ')
    Object.keys(config.DATABASE_NAME).map(marker => console.log(`${marker}: ${config.DATABASE_NAME[marker]}`))
 });
