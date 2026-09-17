import {describe,expect,it} from 'vitest';
import {parseCalendar,reconcileCalendar} from './calendar';
import {buildGradeDates,defaultState} from './model';
import {monthRaw} from './engine';

const feed=(events:string)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}\r\nEND:VCALENDAR`;
const event=(date:string)=>`BEGIN:VEVENT\r\nUID:synthetic-${date}@example.invalid\r\nDTSTART;VALUE=DATE:${date.replaceAll('-','')}\r\nSUMMARY:Guardia\r\nEND:VEVENT`;
const dates=['2025-09-30','2025-10-01','2025-10-31','2025-11-01','2025-11-30','2025-12-01','2025-12-31','2026-01-01','2026-12-31','2027-01-01'];
const cases=[{payDelay:0,from:'2026-01-01'},{payDelay:1,from:'2025-12-01'},{payDelay:2,from:'2025-11-01'},{payDelay:3,from:'2025-10-01'}];

describe('intervalo de calendario por retraso de cobro',()=>{
 it.each(cases)('incluye las guardias necesarias para enero con $payDelay meses de retraso',({payDelay,from})=>{
  const state=defaultState();
  Object.assign(state.settings,{payDelay,profileComplete:true,residencyStart:'2024-07-01',residencyEnd:'2029-06-30',gradeDates:buildGradeDates('2024-07-01')});
  const parsed=parseCalendar(feed(dates.map(event).join('\r\n')),2026,state.settings);
  expect(parsed.from).toBe(from);
  expect(parsed.until).toBe('2027-01-01');
  expect(parsed.shifts.map(s=>s.date)).toEqual(dates.filter(date=>date>=from&&date<'2027-01-01'));
  state.shifts=parsed.shifts;
  const january=monthRaw(state,'2026-01');
  expect(january.workedMonth).toBe(from.slice(0,7));
  expect(january.guards.count).toBe(dates.filter(date=>date.startsWith(from.slice(0,7))).length);
  expect(january.guards.gross).toBeGreaterThan(0);
  const existing=parsed.shifts.map(s=>({...s,sourceCalendar:'synthetic-calendar'}));
  expect(reconcileCalendar(existing,parsed,'synthetic-calendar').every(p=>p.kind==='unchanged')).toBe(true);
  const missing=reconcileCalendar(existing,parseCalendar(feed(''),2026,state.settings),'synthetic-calendar');
  expect(missing).toHaveLength(existing.length);
  expect(missing.every(p=>p.kind==='missing'&&p.action==='keep')).toBe(true);
 });

 it.each(cases)('aplica el mismo intervalo a eventos recurrentes con $payDelay meses de retraso',({payDelay,from})=>{
  const settings={...defaultState().settings,payDelay};
  const recurring=event('2025-10-01').replace('END:VEVENT','RRULE:FREQ=MONTHLY;COUNT=4\r\nEND:VEVENT');
  const parsed=parseCalendar(feed(recurring),2026,settings);
  expect(parsed.shifts.map(s=>s.date)).toEqual(['2025-10-01','2025-11-01','2025-12-01','2026-01-01'].filter(date=>date>=from));
 });
});
