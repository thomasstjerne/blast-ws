
const spawn = require('child_process').spawn;
const config = require('./config');
const async = require('async');
const fs = require('fs');


/*
This version of the blastQueue uses child_process.spawn opening '/bin/bash' shells. 
It utilises blastn´s ability to take bash subprocesses: https://www.biostars.org/p/17265/
Therefore it doesn´t need to write the query files and clean them up afterwards.
Surprisingly, performance tests shows that this approach is not faster than reading query sequences from files. 
*/

const blastQueue = async.queue(function(options, callback) {
    //  blastn -db /Users/thomas/unite -query /Users/thomas/blast/seq/test.fasta -outfmt "6 qseqid sseqid pident length evalue bitscore qseq sseq" -max_target_seqs 2
    let params =  ['-query', `<(echo -e ">${options.id}\n${options.seq}")`,
    '-db', config.BLAST_DATABASE_PATH + config.DATABASE_NAME[options.marker],
    '-outfmt', '"6 sseqid pident length evalue bitscore qseq sseq qstart qend sstart send qcovs"', // 6,
    '-max_target_seqs', !isNaN(parseInt(options.max_target_seqs)) && parseInt(options.max_target_seqs) <= config.LIMIT_MAX_TARGET_SEQS ? options.max_target_seqs : config.MAX_TARGET_SEQS,
    '-num_threads', config.NUM_THREADS,
    '-qcov_hsp_perc', config.MINIMUM_QUERY_COVER,
    '-max_hsps', 1
];
if(options.perc_identity){
    params = [...params, '-perc_identity', options.perc_identity]
}

// console.log('blastn '+params.join(" "))
    let pcs = spawn('blastn',
          params,
          {stdio: [0, 'pipe', 0], shell: '/bin/bash'});
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
}, config.NUM_CONCURRENT_PROCESSES);

module.exports = blastQueue;