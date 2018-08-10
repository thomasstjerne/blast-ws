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

const blastColumns = ['query id', 'subject id', '% identity', 'alignment length', 'mismatches', 'gap opens', 'q. start', 'q. end', 's. start', 's. end', 'evalue', 'bit score'];


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

app.post('/blast', function(req, res) {
    let filename = req.id + '.fasta';
    let seq = req.body.sequence;
    try {
        blastQueue.push({filename: filename, seq: seq}, function(err, blastCliOutput) {
            if (err) {
                console.log(err);
                res.status(500).send(err);
            } else {
                let blastJson = blastResultToJson(blastCliOutput);
                let match = (blastJson.matchType !== 'BLAST_NO_MATCH') ? getMatch(blastJson) : blastJson;
                match.sequenceLength = (seq) ? seq.length : 0;
                res.status(200).json(match);
            }
        });
    } catch (err) {
        console.log(err);
    }
});

app.post('/blast/raw', function(req, res) {
    let filename = req.id + '.fasta';
    let seq = req.body.sequence;

    try {
        blastQueue.push({filename: filename, req_id: req.id, seq: seq}, function(err, blastCliOutput) {
            if (err) {
                console.log(err);
                res.status(500).send(err);
            } else {
                let match = blastResultToJson(blastCliOutput);
                match.sequenceLength = seq.length;
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
            let pcs = spawn('blastn',
                ['-query', config.BLAST_SEQ_PATH + options.filename,
                    '-db', config.BLAST_DATABASE_PATH + config.DATABASE_NAME,
                    '-outfmt', 6,
                    '-max_target_seqs', config.MAX_TARGET_SEQS,
                    '-num_threads', config.NUM_THREADS],
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

function getMatchType(match) {
    if (!match) {
        return 'BLAST_NO_MATCH';
    } else if (Number(match['% identity']) > config.MATCH_THRESHOLD) {
        return 'BLAST_EXACT_MATCH';
    } else if (Number(match['% identity']) > config.MATCH_CLOSE_THRESHOLD) {
        return 'BLAST_CLOSE_MATCH';
    } else {
        return 'BLAST_WEAK_MATCH';
    }
}

function simplyfyMatch(match) {
    let splitted = match['subject id'].split('|');
    return {
        'name': splitted[2],
        'identity': Number(match['% identity']),
        'appliedScientificName': splitted[0],
        'matchType': getMatchType(match),
        'bitScore': Number(match['bit score']),
        'expectValue': Number(match['evalue'])
    };
}

function getMatch(matches) {
    try {
        let best = _.maxBy(matches, function(o) {
            return Number(o['% identity']);
        });
        let otherMatches = _.reduce(matches, function(alternatives, match) {
            if (match !== best && match['subject id']) {
                alternatives.push(simplyfyMatch(match));
            }
            return alternatives;
        }, []);

        let mapped = simplyfyMatch(best);
        mapped.alternatives = otherMatches;
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
        return json;
    } else {
        return {matchType: 'BLAST_NO_MATCH'};
    }
}

