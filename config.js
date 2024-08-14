const BLAST_SEQ_PATH = '/Users/vgs417/blast/seq/';
const BLAST_DATABASE_PATH = '/Users/vgs417/blast/db/';
const DATABASE_NAME_COI =  'bold_COI5P_99_consensus_2024_07_19.fasta' // 'bold_COI5P_99_consensus_2024_01_06.fasta'; //'bold_COI5P_99_consensus_2023_03_12.fasta'; // 'bold_COI5P_99_consensus_2022_02_22.fasta'; // 'bold_COI5P_99_consensus_2021_03_18.fasta'; //'bold_COI5P_99_consensus.fasta';
const DATABASE_NAME_ITS =  'sh_general_release_dynamic_s_all_25.07.2023.fasta'; // 'sh_general_release_dynamic_s_all_29.11.2022.fasta'; //'sh_general_release_dynamic_s_04.02.2020.fasta';
const DATABASE_NAME_16S =  'gtdb_ssu_reps_r214.fasta'; // 'gtdb_ssu_reps_r207.fasta'; //'gtdb_ssu_reps_r202.fasta'; // 'gtdb_ssu_reps_r95.fasta';
const DATABASE_NAME_12S = 'mitofish.12S.Dec2023.fasta'; //'mitofish.12S.May2023.fasta'
const DATABASE_NAME_18S = 'pr2_version_5.0.0_merged.fasta';
const MATCH_THRESHOLD_ITS = 99; // 98.5;
const MATCH_THRESHOLD_COI = 99;
const MATCH_THRESHOLD_16S = 99;
const MATCH_THRESHOLD_12S = 99;
const MATCH_THRESHOLD_18S = 99;
const MATCH_CLOSE_THRESHOLD = 90;
const SUPPORTED_MARKERS = ['its', 'coi', 'co1', '16s', '12s', '18s'];
const MAX_TARGET_SEQS = 5;
const LIMIT_MAX_TARGET_SEQS = 100;
const MINIMUM_QUERY_COVER =  50;// 80; // Minimum percentage of subject that is included in alignment
const NUM_THREADS = 1; // NUM_THREADS * NUM_CONCURRENT_PROCESSES should be equal to the number of cores available for this service
const NUM_CONCURRENT_PROCESSES = 8;
const CACHE_CONCURRENCY  = 50;

const env = process.env.NODE_ENV || 'local';
console.log('ENV: ' + env);


const HBASE = {
  hosts: ['uc6n10.gbif.org'], //["c4master1-vh.gbif.org", "c4master2-vh.gbif.org", "c3master3-vh.gbif.org"],
  port: 31995,
  tableName: 'blast_cache'
  
}; 



const config = {
  local: {
    BLAST_SEQ_PATH: BLAST_SEQ_PATH,
    BLAST_DATABASE_PATH: BLAST_DATABASE_PATH,
    DATABASE_NAME: {'ITS': DATABASE_NAME_ITS, 'COI': DATABASE_NAME_COI, '16S': DATABASE_NAME_16S, '12S': DATABASE_NAME_12S, '18S': DATABASE_NAME_18S },
    MATCH_THRESHOLD: {'ITS': MATCH_THRESHOLD_ITS, 'COI': MATCH_THRESHOLD_COI, '16S': MATCH_THRESHOLD_16S, '12S': MATCH_THRESHOLD_12S, '18S': MATCH_THRESHOLD_18S},
    MATCH_CLOSE_THRESHOLD: {'ITS': MATCH_CLOSE_THRESHOLD, 'COI': MATCH_CLOSE_THRESHOLD, '16S': MATCH_CLOSE_THRESHOLD, '12S': MATCH_CLOSE_THRESHOLD, '18S': MATCH_CLOSE_THRESHOLD},
    SUPPORTED_MARKERS: SUPPORTED_MARKERS,
    MAX_TARGET_SEQS: MAX_TARGET_SEQS,
    LIMIT_MAX_TARGET_SEQS: LIMIT_MAX_TARGET_SEQS,
    MINIMUM_QUERY_COVER: MINIMUM_QUERY_COVER,
    NUM_THREADS: NUM_THREADS,
    NUM_CONCURRENT_PROCESSES: NUM_CONCURRENT_PROCESSES,
    EXPRESS_PORT: 9001,
    HBASE: HBASE,
    CACHE_CONCURRENCY: CACHE_CONCURRENCY
  },
  production: {
    BLAST_SEQ_PATH: '/home/tsjeppesen/seq/',
    BLAST_DATABASE_PATH: '/home/tsjeppesen/',
    DATABASE_NAME: {'ITS': DATABASE_NAME_ITS, 'COI': DATABASE_NAME_COI, '16S': DATABASE_NAME_16S, '12S': DATABASE_NAME_12S, '18S': DATABASE_NAME_18S },
    MATCH_THRESHOLD: {'ITS': MATCH_THRESHOLD_ITS, 'COI': MATCH_THRESHOLD_COI, '16S': MATCH_THRESHOLD_16S, '12S': MATCH_THRESHOLD_12S, '18S': MATCH_THRESHOLD_18S},
    MATCH_CLOSE_THRESHOLD: {'ITS': MATCH_CLOSE_THRESHOLD, 'COI': MATCH_CLOSE_THRESHOLD, '16S': MATCH_CLOSE_THRESHOLD, '12S': MATCH_CLOSE_THRESHOLD, '18S': MATCH_CLOSE_THRESHOLD},
    SUPPORTED_MARKERS: SUPPORTED_MARKERS,
    MAX_TARGET_SEQS: MAX_TARGET_SEQS,
    LIMIT_MAX_TARGET_SEQS: LIMIT_MAX_TARGET_SEQS,
    MINIMUM_QUERY_COVER: MINIMUM_QUERY_COVER,
    NUM_THREADS: NUM_THREADS,
    NUM_CONCURRENT_PROCESSES: NUM_CONCURRENT_PROCESSES,
    EXPRESS_PORT: 80,
    HBASE: HBASE,
    CACHE_CONCURRENCY: CACHE_CONCURRENCY
  }
};

module.exports = config[env];
