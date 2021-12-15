'use strict';
const _ = require('lodash');
const express = require('express');
const app = express();
const addRequestId = require('express-request-id')();
const http = require('http').Server(app);
const bodyParser = require('body-parser');
const spawn = require('child_process').spawn;
const config = require('./config');
const async = require('async');
const fs = require('fs');

// const blastColumns = ['query id', 'subject id', '% identity', 'alignment length', 'mismatches', 'gap opens', 'q. start', 'q. end', 's. start', 's. end', 'evalue', 'bit score'];
const blastColumns = ['subject id', '% identity', 'alignment length', 'evalue', 'bit score', 'query sequence', 'subject sequence', 'qstart', 'qend', 'sstart', 'send', '% query cover'];


app.use(addRequestId);
app.use(bodyParser.json({
    limit: '1mb'
}));

app.use('/blast', function(req, res, next) {
    let marker = req.body.marker;
    if (!marker) {
        res.status(422).json({'error': 'No marker given'});
    } else if (config.SUPPORTED_MARKERS.indexOf(marker.substring(0, 3).toLowerCase()) === -1) {
        res.status(422).json({'error': 'Unsupported marker'});
    } else {
        next();
    }
});

app.use('/blast', function(req, res, next) {
    let sequence = req.body.sequence;
    if (!sequence) {
        res.status(422).json({'error': 'No sequence given'});
    } else {
        next();
    }
});

app.post('/blast', function(req, res) {
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
                res.status(200).json(match);
            }
        });
    } catch (err) {
        console.log(err);
    }
});

app.post('/blast/raw', function(req, res) {
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
});

let blastQueue = async.queue(function(options, callback) {
    fs.writeFile(config.BLAST_SEQ_PATH + options.filename, '>' + options.req_id + '\n' + options.seq, 'utf-8', function(e) {
        if (e) {
            callback(e, null);
        } else {
          //  blastn -db /Users/thomas/unite -query /Users/thomas/blast/seq/test.fasta -outfmt "6 qseqid sseqid pident length evalue bitscore qseq sseq" -max_target_seqs 2
          let params =  ['-query', config.BLAST_SEQ_PATH + options.filename,
          '-db', config.BLAST_DATABASE_PATH + config.DATABASE_NAME[options.marker],
          '-outfmt', '6 sseqid pident length evalue bitscore qseq sseq qstart qend sstart send qcovs', // 6,
          '-max_target_seqs', options.max_target_seqs || config.MAX_TARGET_SEQS,
          '-num_threads', config.NUM_THREADS,
          '-qcov_hsp_perc', config.MINIMUM_QUERY_COVER,
          '-max_hsps', 1
      ];
      if(options.perc_identity){
          params = [...params, '-perc_identity', options.perc_identity]
      }
          let pcs = spawn('blastn',
                params,
                {stdio: [0, 'pipe', 0]});
            let string = '';

            pcs.on('error',
                function(e) {
                    callback(e, null);
                    console.log(e);
                });
            if (pcs.stdout) {
                pcs.stdout.on('data', function(chunk) {
                    let part = chunk.toString();
                    string += part;
                });

                pcs.stdout.on('end', function() {
                    fs.unlink(config.BLAST_SEQ_PATH + options.filename, function(e1) {
                        if (e1) {
                            console.log('Failed to remove seq file: ' + options.filename);
                        }
                    });
                    callback(null, string);
                    pcs.stdout.destroy();
                });
            }
            if (pcs.stderr) {
                pcs.stderr.destroy();
            }
            if (pcs.stdin) {
                pcs.stdin.destroy();
            }
        }
    });
}, config.NUM_CONCURRENT_PROCESSES);

http.listen(config.EXPRESS_PORT, function() {
    console.log('Express server listening on port ' + config.EXPRESS_PORT);
});

const sanitizeSequence = (sequence) => sequence.replace(/[^ACGTURYSWKMBDHVNacgturyswkmbdhvn]/g, '');

function getMatchType(match, marker) {
    if (!match) {
        return 'BLAST_NO_MATCH';
    } else if (Number(match['% identity']) > config.MATCH_THRESHOLD[marker] /* && Number(match['% query cover']) >= config.MINIMUM_QUERY_COVER */) {
        return 'BLAST_EXACT_MATCH';
    } else if (Number(match['% identity']) > config.MATCH_CLOSE_THRESHOLD[marker] /* && Number(match['% query cover']) >= config.MINIMUM_QUERY_COVER */) {
        return 'BLAST_CLOSE_MATCH';
    } else {
        return 'BLAST_WEAK_MATCH';
    }
}

function simplyfyMatch(match, bestIdentity, marker) {
    let splitted = match['subject id'].split('|');
    return {
        'name': splitted[2].replace(/_/g, ' '), // white space is not allowed in fasta headers and usually replaced with _
        'identity': Number(match['% identity']),
        'appliedScientificName': splitted[0],
        'matchType': getMatchType(match, marker),
        'bitScore': Number(match['bit score']),
        'expectValue': Number(match['evalue']),
        'querySequence': match['query sequence'],
        'subjectSequence': match['subject sequence'],
        'qstart': match['qstart'],
        'qend': match['qend'],
        'sstart': match['sstart'],
        'send': match['send'],
        'qcovs': Number(match['% query cover']),
        'distanceToBestMatch': bestIdentity - Number(match['% identity'])
    };
}

function getMatch(matches, marker, verbose) {
    try {
        let best = _.maxBy(matches, function(o) {
           return Number(o['bit score']);
        });
        let otherMatches = _.reduce(matches, function(alternatives, match) {
            if (match !== best && match['subject id']) {
                alternatives.push(simplyfyMatch(match, best['% identity'], marker));
            }
            return alternatives;
        }, []);

        let mapped = simplyfyMatch(best, best['% identity'], marker);
        if (verbose) {
            mapped.alternatives = otherMatches;
           } else {
            const alternatives = otherMatches.filter((a) => a.matchType === 'BLAST_EXACT_MATCH' && a.distanceToBestMatch < (100 - config.MATCH_THRESHOLD));
            if (alternatives.length > 0) {
                mapped.alternatives = alternatives;
                if (mapped.matchType === 'BLAST_EXACT_MATCH') {
                    // ambiguous
                    mapped.matchType = 'BLAST_AMBIGUOUS_MATCH';
                }
            }
           }
        return mapped;
    } catch (err) {
        console.log(err);
        // in this case matches is matchType NONE
        return matches;
    }
}

function blastResultToJson(blastResult) {
    if (blastResult) {
        let matches = blastResult.split('\n');
        let json = matches.map(function(m) {
            let splitted = m.split('\t');
            let res = {};
            for (let i = 0; i < splitted.length; i++) {
                res[blastColumns[i]] = splitted[i];
            }
            return res;
        });
       // console.log(json);

        return json;
    } else {
        return {matchType: 'BLAST_NO_MATCH'};
    }
}

function blastOptionsFromRequest(req) {
    let filename = req.id + '.fasta';
    let seq = sanitizeSequence(req.body.sequence);
    let marker;
     if (req.body.marker.substring(0, 3).toLowerCase() === 'coi' || req.body.marker.substring(0, 3).toLowerCase() === 'co1') {
         marker = 'COI';
     } else if (req.body.marker.substring(0, 3).toLowerCase() === 'its') {
         marker = 'ITS';
     } else if (req.body.marker.substring(0, 3).toLowerCase() === '16s') {
        marker = '16S';
    }
    let options = {filename: filename, seq: seq, marker: marker};
    const perc_identity = _.get(req, 'body.perc_identity'); 
    const max_target_seqs = _.get(req, 'body.max_target_seqs'); 
    if(perc_identity&& !isNaN(parseInt(perc_identity))){
        options.perc_identity = perc_identity
    }
    if(max_target_seqs && !isNaN(parseInt(max_target_seqs))){
        options.max_target_seqs = max_target_seqs
    }
    return options;
}

