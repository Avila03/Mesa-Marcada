import {strict as assert} from "node:assert";
import {readFileSync,readdirSync} from "node:fs";
const dir=new URL("../supabase/migrations/",import.meta.url);
const files=readdirSync(dir).filter(x=>x.endsWith(".sql"));
const history=JSON.parse(readFileSync(new URL("../supabase/migration-baseline.json",import.meta.url),"utf8"));
for(const {version,name} of history)assert.ok(files.includes(version+"_"+name+".sql"),"Missing applied migration "+version);
assert.equal(new Set(files.map(f=>f.split("_")[0])).size,files.length,"Duplicate migration versions");
for(const file of files){
 const sql=readFileSync(new URL(file,dir),"utf8").replace(/--[^\n]*/g,"");
 assert.ok(!/\bTRUNCATE\b|\bDELETE\s+FROM\s+(?:public\.)?sessions\b/i.test(sql),"Destructive historical cleanup in migration path: "+file);
}
console.log("✓ Applied migration identifiers match baseline; destructive maintenance is excluded");
