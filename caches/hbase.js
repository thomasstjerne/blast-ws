const _ = require('lodash');

const config = require('../config').HBASE;
const thrift = require('thrift'),
  HBase = require('./gen-nodejs/HBase.js'),
  HBaseTypes = require('./gen-nodejs/HBase_types.js'),
  connection = thrift.createConnection(config.hosts[0], config.port, {
    transport: thrift.TBufferedTransport,
    protocol: thrift.TBinaryProtocol
  });
const client = thrift.createClient(HBase,connection);

  connection.on('connect', function() {
    client.getTableNames(function(err,data) {
      if (err) {
        console.log('get table names error:', err);
      } else {
       // console.log('hbase tables:', data.map(t => t.toString()));
        const table = data.find(t => t.toString() === config.tableName);
        if(table){
            console.log(`Hbase table ${config.tableName} found. Cache is ready.`)
        } else {
            console.log(`Hbase table ${config.tableName} NOT found. Caching will not work`)
        }
      }
     // connection.end();
    });
  });


const set = async (sequence, database, data) => {

    try{
        var data = [new HBaseTypes.Mutation({column:'ref:sourcedb','value':database}), new HBaseTypes.Mutation({column:'ref:data','value': JSON.stringify(data)})];
        client.mutateRow(config.tableName, sequence, data, null, function(error, success){
            if(error){
                console.log(error)
            } else {
               // console.log("Insertion succeeded")
            }
            
        })
    } catch(e) {
        console.log(e);
    }
}

const get = async (sequence, database) => {

    return new Promise((resolve, reject) => {
            client.getRow(config.tableName, sequence, null, function(error, data){
                if(error){
                    console.log(error)
                    reject(error)
                } else {
                    // console.log("Get succeeded")
                    let result = data.find(row => _.get(row, 'columns["ref:sourcedb"].value', '').toString() === database)
                    if(result){
                        resolve(JSON.parse(_.get(result, 'columns["ref:data"].value', '').toString()))
                    } else {
                        reject("Not found")
                    }
                   
                }
                
            })
        
    })
    
}

module.exports = {
    set,
    get
};