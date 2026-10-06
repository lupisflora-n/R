export const MAX_PACK_BYTES=50*1024*1024;
export const MAX_EXPANDED_BYTES=100*1024*1024;
export function checkZip(bytes:Uint8Array):{expandedBytes:number;entries:number} {
  if(bytes.byteLength>MAX_PACK_BYTES || bytes.length<22)throw new Error('復元ZIPは50 MB以下を選んでください。');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder('utf-8',{fatal:true});
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50 && i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0)throw new Error('ZIPの終端が不正です。');
  const count=view.getUint16(end+10,true),start=view.getUint32(end+16,true),size=view.getUint32(end+12,true);
  if(view.getUint16(end+4,true)!==0 || view.getUint16(end+6,true)!==0 || view.getUint16(end+8,true)!==count || count>200 || start+size!==end)throw new Error('分割ZIP・ZIP64・過大件数には対応していません。');
  const names=new Set<string>();let position=start,total=0;
  for(let i=0;i<count;i++) {
    if(position+46>end || view.getUint32(position,true)!==0x02014b50)throw new Error('ZIPの索引が不正です。');
    const flags=view.getUint16(position+8,true),method=view.getUint16(position+10,true),compressed=view.getUint32(position+20,true),expanded=view.getUint32(position+24,true);
    const n=view.getUint16(position+28,true),extra=view.getUint16(position+30,true),comment=view.getUint16(position+32,true),local=view.getUint32(position+42,true);
    if(position+46+n+extra+comment>end || flags&1 || ![0,8].includes(method) || expanded>MAX_EXPANDED_BYTES || compressed>MAX_PACK_BYTES || view.getUint16(position+34,true)!==0)throw new Error('ZIPの形式・サイズが対応範囲外です。');
    const name=decoder.decode(bytes.subarray(position+46,position+46+n));
    if(!/^(manifest\.json|assets\/[0-9a-f-]{36}\.bin)$/.test(name) || names.has(name))throw new Error('ZIPに不正または重複したパスがあります。');
    if(local+30>start || view.getUint32(local,true)!==0x04034b50)throw new Error('ZIPのファイル参照が不正です。');
    const ln=view.getUint16(local+26,true),le=view.getUint16(local+28,true);
    if(local+30+ln+le+compressed>start || decoder.decode(bytes.subarray(local+30,local+30+ln))!==name || view.getUint16(local+8,true)!==method)throw new Error('ZIPのファイル名・境界が一致しません。');
    total+=expanded;if(total>MAX_EXPANDED_BYTES)throw new Error('ZIPの展開量が大きすぎます。');
    names.add(name);position+=46+n+extra+comment;
  }
  if(position!==end || !names.has('manifest.json'))throw new Error('復元用manifestがありません。');
  return {expandedBytes:total,entries:count};
}
