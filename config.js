const BLAST_SEQ_PATH = '/Users/thomas/blast/seq/';
const BLAST_DATABASE_PATH = '/Users/thomas/blast/db/';
const DATABASE_NAME_COI =  'bold_COI5P_99_consensus_2021_03_18.fasta'; //'bold_COI5P_99_consensus.fasta';
const DATABASE_NAME_ITS = 'sh_general_release_dynamic_s_04.02.2020.fasta'; //'sh_general_release_dynamic_s_02.02.2019.fasta';
const DATABASE_NAME_16S =  'gtdb_ssu_reps_r202.fasta'; // 'gtdb_ssu_reps_r95.fasta';
const MATCH_THRESHOLD_ITS = 99; // 98.5;
const MATCH_THRESHOLD_COI = 99;
const MATCH_THRESHOLD_16S = 99;
const MATCH_CLOSE_THRESHOLD = 90;
const SUPPORTED_MARKERS = ['its', 'coi', 'co1', '16s'];
const MAX_TARGET_SEQS = 5;
const LIMIT_MAX_TARGET_SEQS = 100;
const MINIMUM_QUERY_COVER = 80; // Minimum percentage of subject that is included in alignment
const NUM_THREADS = 1; // NUM_THREADS * NUM_CONCURRENT_PROCESSES should be equal to the number of cores available for this service
const NUM_CONCURRENT_PROCESSES = 8;
const env = process.env.NODE_ENV || 'local';
console.log('ENV: ' + env);

const config = {
  local: {
    BLAST_SEQ_PATH: BLAST_SEQ_PATH,
    BLAST_DATABASE_PATH: BLAST_DATABASE_PATH,
    DATABASE_NAME: {'ITS': DATABASE_NAME_ITS, 'COI': DATABASE_NAME_COI, '16S': DATABASE_NAME_16S},
    MATCH_THRESHOLD: {'ITS': MATCH_THRESHOLD_ITS, 'COI': MATCH_THRESHOLD_COI, '16S': MATCH_THRESHOLD_16S},
    MATCH_CLOSE_THRESHOLD: {'ITS': MATCH_CLOSE_THRESHOLD, 'COI': MATCH_CLOSE_THRESHOLD, '16S': MATCH_CLOSE_THRESHOLD},
    SUPPORTED_MARKERS: SUPPORTED_MARKERS,
    MAX_TARGET_SEQS: MAX_TARGET_SEQS,
    LIMIT_MAX_TARGET_SEQS: LIMIT_MAX_TARGET_SEQS,
    MINIMUM_QUERY_COVER: MINIMUM_QUERY_COVER,
    NUM_THREADS: NUM_THREADS,
    NUM_CONCURRENT_PROCESSES: NUM_CONCURRENT_PROCESSES,
    EXPRESS_PORT: 9000
  },
  production: {
    BLAST_SEQ_PATH: '/home/tsjeppesen/seq/',
    BLAST_DATABASE_PATH: '/home/tsjeppesen/',
    DATABASE_NAME: {'ITS': DATABASE_NAME_ITS, 'COI': DATABASE_NAME_COI, '16S': DATABASE_NAME_16S},
    MATCH_THRESHOLD: {'ITS': MATCH_THRESHOLD_ITS, 'COI': MATCH_THRESHOLD_COI, '16S': MATCH_THRESHOLD_16S},
    MATCH_CLOSE_THRESHOLD: {'ITS': MATCH_CLOSE_THRESHOLD, 'COI': MATCH_CLOSE_THRESHOLD, '16S': MATCH_CLOSE_THRESHOLD},
    SUPPORTED_MARKERS: SUPPORTED_MARKERS,
    MAX_TARGET_SEQS: MAX_TARGET_SEQS,
    LIMIT_MAX_TARGET_SEQS: LIMIT_MAX_TARGET_SEQS,
    MINIMUM_QUERY_COVER: MINIMUM_QUERY_COVER,
    NUM_THREADS: NUM_THREADS,
    NUM_CONCURRENT_PROCESSES: NUM_CONCURRENT_PROCESSES,
    EXPRESS_PORT: 80
  }
};

module.exports = config[env];
