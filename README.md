# blast-ws

A thin rest service on top af blast.

### Requirements

* Node version v8.9.4 installed.
* [blast installed](https://www.ncbi.nlm.nih.gov/books/NBK279671/), and a blast database created for querying

### Install

Download a reference dataset: https://unite.ut.ee/repository.php - choose the "General FASTA release"

Make a blast database: 

`makeblastdb -in sh_general_release_dynamic_01.12.2017.fasta -title unite -parse_seqids -dbtype nucl`

Clone this repository:

`git clone https://github.com/thomasstjerne/blast-ws.git`

cd in to the directory:

`cd blast-ws`

install dependencies:

`npm install`



### Run the service

`node app.js`

### Usage

`POST http://localhost:9000/blast`

The body of your request should be a JSON object:

```javascript
{
  "marker": "ITS", 
  "sequence": "TTAGAGGAAGTAAAAGTCGTAACAAGGTTTCCGTAGGTGAACCTGCGGAAGGATCATTATTGAAATAAACCT......."
 }
```

### Example

```
curl --header "Content-Type: application/json" \
  --request POST \
  --data '{"sequence" : "TTAGAGGAAGTAAAAGTCGTAACAAGGTTTCCGTAGGTGAACCTGCGGAAGGATCATTATTGAAATAAACCTGATGAGTTGTTGCTGGCTCTCTAGGGAGCATGTGCACACTTGTCATCTTTGTATCTTCACCTGTGCACCTTTTGTAGACCTTGGGTATCTATCTGATTGCTTTAGCACTCAGGATTGAGGATTGACTTCTTGTCTCTTCTTACATTTCCAGGTCTATGTTTCTTAATATACCCTAATGTATGTTTATAGAATGTAATTAATGGGCCTTTGTGCCTATAAATCTATACAACTTTCAGCAACGGATCTCTTGGCTCTCGCATCGATGAAGAACGCAGCGAAATGCGATAAGTAATGTGAATTGCAGAATTCAGTGAATCATCGAATCTTTGAACGCACCTTGCGCTCCTTGGTATTCCGAGGAGCATGCCTGTTTGAGTGTCATTAATATATCAACCTCTTTGGTTGGATGTGGGGGTTTGCTGGCCACTTGAGGTCAGCTCCTCTTAAATGCATTAGCGGACAACATTTTGCTAAACGTTCATTGGTGTGATAATTATCTACGCTCTTGACGTGAAGCAGGTTCAGCTTCTAACAGTCCATTGACTTGGATAAATTTTTTTCTATCAATGTGACCTCAAATCAGGTAGGACTACCCGCTGAACTTAAGCATATCAATAAGCGGAGGAAAAGAAACTAACAAGGATTCCCCTAGTAACTGCGAGTGAAGCGGGAAAAGCTCAAATTTAAAATCTGGCAGTCTTTGGCTGTCCGAGTTGTAATCTAGAGAAGCATTATCCGCGCTG",
	"marker": "ITS"
}' \
  http://localhost:9000/blast | node <<< "var o = $(cat); console.log(JSON.stringify(o, null, 4));"
```

### HBase cache

```
create 'blast_cache', {NAME=>'ref', VERSIONS => 1, COMPRESSION => 'SNAPPY', DATA_BLOCK_ENCODING => 'FAST_DIFF', BLOOMFILTER => 'NONE'}

hosts: c4master1-vh.gbif.org, c4master2-vh.gbif.org, c4master2-vh.gbif.org
port: 9090

ssh tsjeppesen@c4gateway-vh.gbif.org
> hbase shell
hbase> count 'blast_cache'
hbase> scan 'blast_cache'
```
