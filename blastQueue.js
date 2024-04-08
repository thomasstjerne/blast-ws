const spawn = require('child_process').spawn;
const config = require('./config');
const async = require('async');
const fs = require('fs');
const {getFastaFromRequest} = require('./util.js')
/*
This is version of the blastQueue that have been used since the seq id tool was launched. 
It uses child_process.spawn without opening shells. 
It needs to write the query sequence to a fasta file which is passed to blastn.
When the query completes, the file is removed.
The query sequence files are written to BLAST_SEQ_PATH , and the process needs to have RW access to this directory.
*/

const blastQueue = async.queue(function(options, callback) {
   // const fasta = _.isArray(options.seq) ? : '>' + options.req_id + '\n' + options.seq
    fs.writeFile(config.BLAST_SEQ_PATH + options.filename, getFastaFromRequest(options.seq, options.resultArray), 'utf-8', function(e) {
        if (e) {
            callback(e, null);
        } else {
          //  blastn -db /Users/thomas/unite -query /Users/thomas/blast/seq/test.fasta -outfmt "6 qseqid sseqid pident length evalue bitscore qseq sseq" -max_target_seqs 2
          let params =  ['-query', config.BLAST_SEQ_PATH + options.filename,
          '-db', config.BLAST_DATABASE_PATH + config.DATABASE_NAME[options.marker],
          '-outfmt', '6 sseqid pident length evalue bitscore qseq sseq qstart qend sstart send qcovs qseqid', // 6,
          '-max_target_seqs', !isNaN(parseInt(options.max_target_seqs)) && parseInt(options.max_target_seqs) <= config.LIMIT_MAX_TARGET_SEQS ? options.max_target_seqs : config.MAX_TARGET_SEQS,
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
                    /* fs.unlink(config.BLAST_SEQ_PATH + options.filename, function(e1) {
                        if (e1) {
                            console.log('Failed to remove seq file: ' + options.filename);
                        }
                    }); */
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

module.exports = blastQueue;