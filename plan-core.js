/* Pure calculations shared by the dashboard and Node verification. */
(function(root) {
  'use strict';
  const number = value => Number.isFinite(+value) ? +value : 0;
  const filter = (rows, state = {}) => rows.filter(r =>
    (!state.province || r.province === state.province) &&
    (!state.book || r.pdd_book === state.book) &&
    (!state.type || r.plot.endsWith('-' + state.type)) &&
    (!state.plot || r.plot === state.plot));
  function nextPlot(rows,state={},direction=1) {
    const candidates=filter(rows,{...state,plot:''});
    if(!candidates.length)return '';
    const index=candidates.findIndex(r=>r.plot===state.plot);
    if(index<0)return candidates[direction<0?candidates.length-1:0].plot;
    return candidates[(index+(direction<0?-1:1)+candidates.length)%candidates.length].plot;
  }
  function summary(rows, density = 100) {
    const out = {red:0, yellow:0, redCount:0, check:0, treesRed:0, treesTotal:0};
    for (const r of rows) {
      out.red += number(r.red); out.yellow += number(r.yellow);
      out.redCount += number(r.red_count); out.check += number(r.check);
    }
    out.red = +out.red.toFixed(2); out.yellow = +out.yellow.toFixed(2);
    out.check = +out.check.toFixed(2);
    out.treesRed = Math.round(out.red * Math.max(0,number(density)));
    out.treesTotal = Math.round((out.red + out.yellow) * Math.max(0,number(density)));
    return out;
  }
  function csv(rows, fields) {
    const quote = value => {
      let s = String(value ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"','""') + '"' : s;
    };
    return '\ufeff' + [fields.map(quote).join(','), ...rows.map(r => fields.map(k=>quote(r[k])).join(','))].join('\r\n');
  }
  function groups(rows, key) {
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row[key])) grouped.set(row[key],[]);
      grouped.get(row[key]).push(row);
    }
    return [...grouped].map(([label,rs])=>({label,...summary(rs)})).sort((a,b)=>(b.red+b.yellow)-(a.red+a.yellow));
  }
  const round=value=>+value.toFixed(2);
  function greenAreas(features) {
    const totals=new Map();
    for(const {properties:p} of features)totals.set(p.plot,round((totals.get(p.plot)||0)+number(p.rai)));
    return totals;
  }
  function canopyRows(original,plots,greenFeatures) {
    const byPlot=new Map(plots.map(r=>[r.plot,r])), greens=greenAreas(greenFeatures);
    return original.map(row=>{
      const plan=byPlot.get(row.plot);
      if(!plan)throw new Error('Missing filtered plot: '+row.plot);
      const result={...row,high:greens.get(row.plot)||0,mid:number(plan.yellow),low:number(plan.red),none:number(row.none)};
      result.total=round(result.high+result.mid+result.low+result.none);
      result.boundary=number(plan.boundary_rai);
      return result;
    });
  }
  function canopyTotals(rows) {
    return Object.fromEntries(['high','mid','low','none','total'].map(key=>[key,round(rows.reduce((sum,row)=>sum+number(row[key]),0))]));
  }
  function editionAudit(original,current,comparison) {
    const old=canopyTotals(original), now=canopyTotals(current), byPlot=new Map(current.map(r=>[r.plot,r]));
    const filterRemoved=round(comparison.reduce((sum,r)=>sum+number(r.removed_red),0));
    const sourceRedDifference=round(comparison.reduce((sum,r)=>sum+number(r.dashboard_to_before_red),0));
    const issues=[];
    for(const row of original) {
      const next=byPlot.get(row.plot);if(!next)continue;
      if(number(row.total)>number(row.boundary)+0.07||/อยู่นอกขอบเขต/.test(row.note||''))
        issues.push({plot:row.plot,kind:'boundary',note:row.note||'ยอดเดิมมากกว่าขอบเขต',rai:round(number(row.total)-number(row.boundary))});
      const high=round(number(row.high)-number(next.high)),mid=round(number(row.mid)-number(next.mid));
      if(Math.abs(high)>0.07||Math.abs(mid)>0.07)issues.push({plot:row.plot,kind:'source',high,mid});
      if(number(next.low)>number(row.low)+0.07)issues.push({plot:row.plot,kind:'increase',rai:round(number(next.low)-number(row.low))});
      for(const key of ['high','mid','low','none'])if(!Number.isFinite(+row[key])||+row[key]<0)issues.push({plot:row.plot,kind:'invalid',field:key});
    }
    return {old,current:now,redDifference:round(old.low-now.low),highDifference:round(old.high-now.high),
      midDifference:round(old.mid-now.mid),filterRemoved,sourceRedDifference,issues};
  }
  const api={filter,nextPlot,summary,csv,groups,number,greenAreas,canopyRows,canopyTotals,editionAudit};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.PlanCore=api;
})(globalThis);
