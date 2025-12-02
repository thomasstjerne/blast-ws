const json = require('body-parser/lib/types/json');
const config = require('./config');
const _ = require('lodash');
const blastColumns = ['subject id', '% identity', 'alignment length', 'evalue', 'bit score', 'query sequence', 'subject sequence', 'qstart', 'qend', 'sstart', 'send', '% query cover', 'query id'];


const sanitizeSequence = (sequence) => {
    const sanitized = sequence.replace(/[^ACGTURYSWKMBDHVNacgturyswkmbdhvn]/g, '');
    return sanitized
}

const getMatchType = (match, marker) => {
    if (!match) {
        return 'BLAST_NO_MATCH';
    } else if (Number(match['% identity']) > config.MATCH_THRESHOLD /* && Number(match['% query cover']) >= config.MINIMUM_QUERY_COVER */) {
        return 'BLAST_EXACT_MATCH';
    } else if (Number(match['% identity']) > config.MATCH_CLOSE_THRESHOLD /* && Number(match['% query cover']) >= config.MINIMUM_QUERY_COVER */) {
        return 'BLAST_CLOSE_MATCH';
    } else {
        return 'BLAST_WEAK_MATCH';
    }
}

const simplyfyMatch = (match, bestIdentity, marker) => {
    let splitted = match['subject id'].split('|');
    let accesion = splitted[1];
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
        'distanceToBestMatch': bestIdentity - Number(match['% identity']),
        'accession': accesion || ''
    };
}

const getMatch = (matches, marker, verbose) => {
    try {
        let best = _.maxBy(matches, function(o) {
           return Number(o['% identity']);
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

const blastResultToJson = (blastResult) => {
    if (blastResult) {
        let matches = blastResult.split('\n').filter(m => !!m);
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

const blastOptionsFromRequest = (req) => {
    let dataLocation = (req.body.sequence && req.body.marker) ? 'body' : 'query';
    let filename = req.id + '.fasta';
    let seq = _.isArray(req[dataLocation].sequence) ? req[dataLocation].sequence.map(sanitizeSequence) : sanitizeSequence(req[dataLocation].sequence);
    let marker;
    if( config.SUPPORTED_MARKERS.includes(req[dataLocation].marker?.toLowerCase()) ){
        marker = req[dataLocation].marker.toLowerCase();
    }
     else if (req[dataLocation].marker.substring(0, 3).toLowerCase() === 'coi' || req[dataLocation].marker.substring(0, 3).toLowerCase() === 'co1') {
         marker = 'coi';
     } else if (req[dataLocation].marker.substring(0, 3).toLowerCase() === 'its') {
         marker = 'its';
     } else if (req[dataLocation].marker.substring(0, 3).toLowerCase() === '16s') {
        marker = '16s';
    } else if (req[dataLocation].marker.substring(0, 3).toLowerCase() === '12s') {
        marker = '12s';
    } else if (req[dataLocation].marker.substring(0, 3).toLowerCase() === '18s') {
        marker = '18s';
    } else if (req[dataLocation].marker.substring(0, 4).toLowerCase() === 'rbcl') {
        marker = 'rbcl';
    }
    let options = {id : req.id, filename: filename, seq: seq, marker: marker};
    const perc_identity = _.get(req[dataLocation], 'perc_identity'); 
    const max_target_seqs = _.get(req[dataLocation], 'body.max_target_seqs'); 
    if(perc_identity&& !isNaN(parseInt(perc_identity))){
        options.perc_identity = perc_identity
    }
    if(max_target_seqs && !isNaN(parseInt(max_target_seqs))){
        options.max_target_seqs = max_target_seqs
    }
    return options;
}

const getFastaFromRequest = (seq, resultArray) => {
    const data = typeof seq === 'string' ? [seq] : seq;

    return data.map((s, idx) => {
        // do not blast sequences that was already fetched from cache
        return   !_.get(resultArray, `[${idx}]`) ? `>${idx}\n${s}` : '';
    }).filter(s => !!s).join('\n')
}

const averageSeqLength = array => array.reduce((a, b) => a + b.length, 0) / array.length;

const chunkArray = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

module.exports = {
    sanitizeSequence,
    simplyfyMatch,
    getMatch,
    blastResultToJson,
    blastOptionsFromRequest,
    getFastaFromRequest,
    averageSeqLength,
    chunkArray
}