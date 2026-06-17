# Intro
const mergedDocumentation = `# Tracer - Р•РґРёРЅР°СЏ РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ

## Р’РµСЂСЃРёСЏ 4.3 | Р СѓРєРѕРІРѕРґСЃС‚РІРѕ РїРѕ С‚СЂР°СЃСЃРёСЂРѕРІРєРµ JavaScript-РєРѕРґР°

---

## РћРіР»Р°РІР»РµРЅРёРµ

1. [РўРµСЂРјРёРЅС‹ Рё РѕРїСЂРµРґРµР»РµРЅРёСЏ](#1-С‚РµСЂРјРёРЅС‹-Рё-РѕРїСЂРµРґРµР»РµРЅРёСЏ)
2. [Р’РІРµРґРµРЅРёРµ](#2-РІРІРµРґРµРЅРёРµ)
3. [РЎС‚СЂСѓРєС‚СѓСЂР° СЃРѕР±С‹С‚РёР№ С‚СЂР°СЃСЃРёСЂРѕРІРєРё](#3-СЃС‚СЂСѓРєС‚СѓСЂР°-СЃРѕР±С‹С‚РёР№-С‚СЂР°СЃСЃРёСЂРѕРІРєРё)
4. [Р‘С‹СЃС‚СЂС‹Р№ СЃС‚Р°СЂС‚](#4-Р±С‹СЃС‚СЂС‹Р№-СЃС‚Р°СЂС‚)
5. [РЎР»Р°Р№СЃС‹: РѕС‚СЂРµР·РєРё РІ СЃС‚РµРєРµ РІС‹Р·РѕРІРѕРІ](#5-СЃР»Р°Р№СЃС‹-РѕС‚СЂРµР·РєРё-РІ-СЃС‚РµРєРµ-РІС‹Р·РѕРІРѕРІ)
6. [РћС‚С‡РµС‚С‹: СЃС‚Р°С‚РёСЃС‚РёС‡РµСЃРєРёРµ РјРѕРґРµР»Рё СЃР»Р°Р№СЃРѕРІ](#6-РѕС‚С‡РµС‚С‹-СЃС‚Р°С‚РёСЃС‚РёС‡РµСЃРєРёРµ-РјРѕРґРµР»Рё-СЃР»Р°Р№СЃРѕРІ)
7. [Р¤РёР»СЊС‚СЂР°С†РёСЏ С€СѓРјР°](#7-С„РёР»СЊС‚СЂР°С†РёСЏ-С€СѓРјР°)
8. [API Reference](#8-api-reference)
9. [РђСЃРёРЅС…СЂРѕРЅРЅР°СЏ С‚СЂР°СЃСЃРёСЂРѕРІРєР°](#9-Р°СЃРёРЅС…СЂРѕРЅРЅР°СЏ-С‚СЂР°СЃСЃРёСЂРѕРІРєР°)
10. [РџСЂРѕС„РёР»Рё С‚СЂР°СЃСЃРёСЂРѕРІРєРё](#10-РїСЂРѕС„РёР»Рё-С‚СЂР°СЃСЃРёСЂРѕРІРєРё)
11. [РџСЂР°РєС‚РёС‡РµСЃРєРёРµ РїСЂРёРјРµСЂС‹](#11-РїСЂР°РєС‚РёС‡РµСЃРєРёРµ-РїСЂРёРјРµСЂС‹)
12. [Р РµС€РµРЅРёРµ РїСЂРѕР±Р»РµРј](#12-СЂРµС€РµРЅРёРµ-РїСЂРѕР±Р»РµРј)
13. [Р§РµРєР»РёСЃС‚ СЂР°Р·СЂР°Р±РѕС‚С‡РёРєР°](#13-С‡РµРєР»РёСЃС‚-СЂР°Р·СЂР°Р±РѕС‚С‡РёРєР°)
14. [РўРёРїРёС‡РЅС‹Рµ РѕС€РёР±РєРё](#14-С‚РёРїРёС‡РЅС‹Рµ-РѕС€РёР±РєРё)
15. [РСЃС‚РѕСЂРёСЏ РёР·РјРµРЅРµРЅРёР№](#15-РёСЃС‚РѕСЂРёСЏ-РёР·РјРµРЅРµРЅРёР№)

---

## 1. РўРµСЂРјРёРЅС‹ Рё РѕРїСЂРµРґРµР»РµРЅРёСЏ

| РўРµСЂРјРёРЅ | РћРїСЂРµРґРµР»РµРЅРёРµ |
|--------|-------------|
| **РЎС‚РµРє РІС‹Р·РѕРІРѕРІ (Call Stack)** | РџРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕСЃС‚СЊ РІР»РѕР¶РµРЅРЅС‹С… РІС‹Р·РѕРІРѕРІ С„СѓРЅРєС†РёР№ РІ РїРѕСЂСЏРґРєРµ РёС… РІС‹РїРѕР»РЅРµРЅРёСЏ |
| **Р“Р»СѓР±РёРЅР° СЃС‚РµРєР° (Stack Depth)** | РљРѕР»РёС‡РµСЃС‚РІРѕ РІР»РѕР¶РµРЅРЅС‹С… РІС‹Р·РѕРІРѕРІ РІ С‚РµРєСѓС‰РёР№ РјРѕРјРµРЅС‚ |
| **РЎР»Р°Р№СЃ (Slice)** | РћС‚СЂРµР·РѕРє РІ СЃС‚РµРєРµ РІС‹Р·РѕРІРѕРІ, РѕРіСЂР°РЅРёС‡РµРЅРЅС‹Р№ РґРІСѓРјСЏ С‚РѕС‡РєР°РјРё: РЅР°С‡Р°Р»РѕРј (РІС…РѕРґ РІ С„СѓРЅРєС†РёСЋ) Рё РєРѕРЅС†РѕРј (РІС‹С…РѕРґ РёР· С„СѓРЅРєС†РёРё) |
| **РћС‚С‡РµС‚ (Report)** | РЎС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅР°СЏ СЃС‚Р°С‚РёСЃС‚РёС‡РµСЃРєР°СЏ РјРѕРґРµР»СЊ РѕРґРЅРѕРіРѕ РёР»Рё РЅРµСЃРєРѕР»СЊРєРёС… СЃР»Р°Р№СЃРѕРІ |
| **РЁСѓРј (Noise)** | Р§Р°СЃС‚С‹Рµ, РїРѕРІС‚РѕСЂСЏСЋС‰РёРµСЃСЏ РёР»Рё РјР°Р»РѕР·РЅР°С‡РёРјС‹Рµ РІС‹Р·РѕРІС‹, РєРѕС‚РѕСЂС‹Рµ Р·Р°СЃРѕСЂСЏСЋС‚ Р»РѕРіРё |
| **NoisyCalls** | РЎРїРёСЃРѕРє РїРѕР»РЅС‹С… РёРјРµРЅ С„СѓРЅРєС†РёР№, РєРѕС‚РѕСЂС‹Рµ РёСЃРєР»СЋС‡Р°СЋС‚СЃСЏ РёР· С‚СЂР°СЃСЃРёСЂРѕРІРєРё |
| **NoisyProperties** | РЎРїРёСЃРѕРє РїРѕР»РЅС‹С… РёРјРµРЅ СЃРІРѕР№СЃС‚РІ, РєРѕС‚РѕСЂС‹Рµ РёСЃРєР»СЋС‡Р°СЋС‚СЃСЏ РёР· С‚СЂР°СЃСЃРёСЂРѕРІРєРё |
| **CallFilter** | Р¤СѓРЅРєС†РёСЏ РґР»СЏ РіРёР±РєРѕР№ С„РёР»СЊС‚СЂР°С†РёРё РІС‹Р·РѕРІРѕРІ РїРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕР№ Р»РѕРіРёРєРµ |
| **PropertyFilter** | Р¤СѓРЅРєС†РёСЏ РґР»СЏ РіРёР±РєРѕР№ С„РёР»СЊС‚СЂР°С†РёРё РґРѕСЃС‚СѓРїР° Рє СЃРІРѕР№СЃС‚РІР°Рј |
| **CallId** | РЈРЅРёРєР°Р»СЊРЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РІС‹Р·РѕРІР° РґР»СЏ СЃРІСЏР·С‹РІР°РЅРёСЏ Р°СЃРёРЅС…СЂРѕРЅРЅС‹С… С†РµРїРѕС‡РµРє |

---

## 2. Р’РІРµРґРµРЅРёРµ

### 2.1 Р§С‚Рѕ С‚Р°РєРѕРµ Tracer?

**Tracer** вЂ” Р±РёР±Р»РёРѕС‚РµРєР° РґР»СЏ runtime-С‚СЂР°СЃСЃРёСЂРѕРІРєРё JavaScript/TypeScript РєРѕРґР°, РїРѕР·РІРѕР»СЏСЋС‰Р°СЏ:

- РћС‚СЃР»РµР¶РёРІР°С‚СЊ РІС‹Р·РѕРІС‹ С„СѓРЅРєС†РёР№ (РґРѕ Рё РїРѕСЃР»Рµ РІС‹РїРѕР»РЅРµРЅРёСЏ)
- РњРѕРЅРёС‚РѕСЂРёС‚СЊ С‡С‚РµРЅРёРµ Рё Р·Р°РїРёСЃСЊ СЃРІРѕР№СЃС‚РІ РѕР±СЉРµРєС‚РѕРІ
- Р’С‹РґРµР»СЏС‚СЊ РѕС‚СЂРµР·РєРё РІ СЃС‚РµРєРµ РІС‹Р·РѕРІРѕРІ (СЃР»Р°Р№СЃС‹)
- РЎС‚СЂРѕРёС‚СЊ СЃС‚Р°С‚РёСЃС‚РёС‡РµСЃРєРёРµ РѕС‚С‡РµС‚С‹ РґР»СЏ Р°РЅР°Р»РёР·Р°
- Р¤РёР»СЊС‚СЂРѕРІР°С‚СЊ С€СѓРјРЅС‹Рµ РІС‹Р·РѕРІС‹
- Р Р°Р±РѕС‚Р°С‚СЊ СЃ Р°СЃРёРЅС…СЂРѕРЅРЅС‹Рј РєРѕРґРѕРј

### 2.2 РћСЃРЅРѕРІРЅР°СЏ РєРѕРЅС†РµРїС†РёСЏ

\`\`\`
РЎС‚РµРє РІС‹Р·РѕРІРѕРІ > РЎР»Р°Р№СЃ (РѕС‚СЂРµР·РѕРє) > РћС‚С‡РµС‚ (СЃС‚Р°С‚РёСЃС‚РёС‡РµСЃРєР°СЏ РјРѕРґРµР»СЊ)
\`\`\`

### 2.3 РџСЂРѕР±Р»РµРјР° С€СѓРјР°

\`\`\`
Р‘РµР· С„РёР»СЊС‚СЂР°С†РёРё:                        РЎ С„РёР»СЊС‚СЂР°С†РёРµР№:

> CEditorPage.onTimerScroll            > PaymentService.processPayment
< CEditorPage.onTimerScroll                > PaymentService.validateAmount
> PaintMessageLoop._animation              < PaymentService.validateAmount
< PaintMessageLoop._animation              > PaymentService.chargeCard
> PaymentService.processPayment            < PaymentService.chargeCard
    > PaymentService.validateAmount    < PaymentService.processPayment
    < PaymentService.validateAmount    
    > PaymentService.chargeCard        
    < PaymentService.chargeCard        
< PaymentService.processPayment        
\`\`\`

---

## 3. РЎС‚СЂСѓРєС‚СѓСЂР° СЃРѕР±С‹С‚РёР№ С‚СЂР°СЃСЃРёСЂРѕРІРєРё

### 3.1 Р‘Р°Р·РѕРІС‹Р№ РёРЅС‚РµСЂС„РµР№СЃ

\`\`\`typescript
interface BaseTraceEvent {
  eventType: 'functionCall' | 'propertyGet' | 'propertySet';
  place: 'before' | 'after';
  fullName: string;      // 'ClassName.methodName'
  className: string;
  fnKey?: string;
  propName?: string;
  tracerState: Map<string, boolean>;
  depth?: number;
  callStack?: any;
  thisArg?: any;
}
\`\`\`

### 3.2 РЎРѕР±С‹С‚РёРµ РІС‹Р·РѕРІР° С„СѓРЅРєС†РёРё

\`\`\`typescript
interface FunctionCallEvent extends BaseTraceEvent {
  eventType: 'functionCall';
  args: any[];
  targetFn: Function;
  startedAt: number;
  callId?: number;
  parentCallId?: number;
  status?: 'started' | 'ok' | 'rejected' | 'error';
  value?: any;
  error?: Error;
  endedAt?: number;
  durationMs?: number;
}
\`\`\`

### 3.3 РЎРѕР±С‹С‚РёРµ С‡С‚РµРЅРёСЏ СЃРІРѕР№СЃС‚РІР°

\`\`\`typescript
interface PropertyGetEvent extends BaseTraceEvent {
  eventType: 'propertyGet';
  propName: string;
  value: any;
}
\`\`\`

### 3.4 РЎРѕР±С‹С‚РёРµ Р·Р°РїРёСЃРё СЃРІРѕР№СЃС‚РІР°

\`\`\`typescript
interface PropertySetEvent extends BaseTraceEvent {
  eventType: 'propertySet';
  propName: string;
  curValue: any;
  value: any;
}
\`\`\`

### 3.5 РџСЂРёРјРµСЂ РѕР±СЂР°Р±РѕС‚РєРё

\`\`\`javascript
function handleTraceEvent(event) {
  switch (event.eventType) {
    case 'functionCall':
      if (event.place === 'before') {
        console.log(\`> \${event.fullName}\`, event.args);
      } else {
        console.log(\`< \${event.fullName} (\${event.durationMs}ms)\`);
      }
      break;
    case 'propertyGet':
      console.log(\`?? \${event.className}.\${event.propName} = \${event.value}\`);
      break;
    case 'propertySet':
      console.log(\`?? \${event.className}.\${event.propName}: \${event.curValue} > \${event.value}\`);
      break;
  }
}

Tracer.traceAll(handleTraceEvent);
\`\`\`

---

## 4. Р‘С‹СЃС‚СЂС‹Р№ СЃС‚Р°СЂС‚

### 4.1 РЈСЃС‚Р°РЅРѕРІРєР°

\`\`\`bash
npm install @scorgi86/tracer
\`\`\`

### 4.2 РРјРїРѕСЂС‚

\`\`\`javascript
import { Tracer } from '@scorgi86/tracer';
import { 
  ReportUsage, 
  ReportTreeView, 
  ReportSimple, 
  ReportSliceDiff,
  ReportSliceUsage 
} from '@scorgi86/tracer/reports';
\`\`\`

### 4.3 РџРµСЂРІР°СЏ С‚СЂР°СЃСЃРёСЂРѕРІРєР°

\`\`\`javascript
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

const tracedCalculate = Tracer.createProxyFn(calculateTotal, 'calculateTotal');

Tracer.traceAll((event) => {
  console.log(\`\${event.eventType}: \${event.fullName}\`);
});

tracedCalculate([{ price: 100 }, { price: 200 }]);
// Р’С‹РІРѕРґ:
// functionCall: calculateTotal
// functionCall: calculateTotal
\`\`\`

### 4.4 РќР°СЃС‚СЂРѕР№РєР° РїСЂРѕС„РёР»СЏ

\`\`\`javascript
Tracer.setTraceProfile('balanced', {
  enableCalls: true,
  enableProperties: false,
  suppressNoisy: true
});

const config = Tracer.getTraceConfig();
console.log(config);
\`\`\`

---

## 5. РЎР»Р°Р№СЃС‹: РѕС‚СЂРµР·РєРё РІ СЃС‚РµРєРµ РІС‹Р·РѕРІРѕРІ

### 5.1 РћРїСЂРµРґРµР»РµРЅРёРµ

**РЎР»Р°Р№СЃ** вЂ” РѕС‚СЂРµР·РѕРє РІ СЃС‚РµРєРµ РІС‹Р·РѕРІРѕРІ РѕС‚ РІС…РѕРґР° РІ С„СѓРЅРєС†РёСЋ РґРѕ РІС‹С…РѕРґР° РёР· РЅРµРµ.

\`\`\`
РџРѕР»РЅС‹Р№ СЃС‚РµРє:              РЎР»Р°Р№СЃ (РѕС‚СЂРµР·РѕРє):
level1                    (РІРЅРµ СЃР»Р°Р№СЃР°)
В¦ level2 <-- РќРђР§РђР›Рћ        В¦
В¦ В¦ level3                В¦
В¦ В¦ level3                В¦
В¦ level2 <-- РљРћРќР•Р¦         В¦
level1                    (РІРЅРµ СЃР»Р°Р№СЃР°)
\`\`\`

### 5.2 РЎРѕР·РґР°РЅРёРµ СЃР»Р°Р№СЃР°

\`\`\`javascript
Tracer.defineSlice('sliceName', {
  predicate: (event) => event.fullName === 'TargetFunction',
  beforeCall: () => {
    console.log('РќРђР§РђР›Рћ РћРўР Р•Р—РљРђ');
    return true;
  },
  afterCall: () => {
    console.log('РљРћРќР•Р¦ РћРўР Р•Р—РљРђ');
    return false;
  },
  initial: false,
  description: 'РћРїРёСЃР°РЅРёРµ'
});
\`\`\`

### 5.3 РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ

\`\`\`javascript
Tracer.traceBySlice('sliceName', (event) => {
  console.log(\`[РћС‚СЂРµР·РѕРє] \${event.fullName}\`);
});

Tracer.enableSlice('sliceName');
Tracer.disableSlice('sliceName');
Tracer.disableSliceListeners('sliceName');
Tracer.untraceBySlice('sliceName');
\`\`\`

### 5.4 Sticky-СЃР»Р°Р№СЃ

\`\`\`javascript
Tracer.defineSlice('debugMode', {
  predicate: (event) => event.fullName === 'enableDebug',
  beforeCall: () => true,
  afterCall: () => true,  // true = РѕСЃС‚Р°РµС‚СЃСЏ Р°РєС‚РёРІРЅС‹Рј
  initial: false
});
\`\`\`

### 5.5 Р’Р»РѕР¶РµРЅРЅС‹Рµ СЃР»Р°Р№СЃС‹

\`\`\`javascript
Tracer.defineSlice('fullProcess', {
  predicate: (event) => event.fullName === 'processAll',
  beforeCall: () => console.log('Р’РµСЃСЊ РїСЂРѕС†РµСЃСЃ РЅР°С‡Р°С‚'),
  afterCall: () => console.log('Р’РµСЃСЊ РїСЂРѕС†РµСЃСЃ Р·Р°РІРµСЂС€РµРЅ')
});

Tracer.defineSlice('validationPart', {
  predicate: (event) => event.fullName === 'validate',
  beforeCall: () => console.log('Р’Р°Р»РёРґР°С†РёСЏ РЅР°С‡Р°С‚Р°'),
  afterCall: () => console.log('Р’Р°Р»РёРґР°С†РёСЏ Р·Р°РІРµСЂС€РµРЅР°')
});
\`\`\`

---

## 6. РћС‚С‡РµС‚С‹: СЃС‚Р°С‚РёСЃС‚РёС‡РµСЃРєРёРµ РјРѕРґРµР»Рё СЃР»Р°Р№СЃРѕРІ

### 6.1 ReportUsage - СЃС‡РµС‚С‡РёРє РІС‹Р·РѕРІРѕРІ

\`\`\`javascript
const usageReport = new ReportUsage({ logProvider: console });

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

usageReport.print();
// Р’С‹РІРѕРґ:
// UserService
// PaymentService
// Class: UserService.login
// Class: PaymentService.processPayment
\`\`\`

### 6.2 ReportTreeView - СЃС‚СЂСѓРєС‚СѓСЂР° РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё

\`\`\`javascript
const treeReport = new ReportTreeView();

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    treeReport.log({
      eventType: 'functionCall',
      place: 'before',
      className: event.className,
      fnKey: event.fnKey
    }, JSON.stringify(event.args));
  } else {
    treeReport.log({
      eventType: 'functionCall',
      place: 'after',
      className: event.className,
      fnKey: event.fnKey
    });
  }
});

const tree = treeReport.getResults();
console.log(tree.join('\\n'));
\`\`\`

### 6.3 ReportSimple - РїР»РѕСЃРєРёР№ СЃРїРёСЃРѕРє

\`\`\`javascript
const simpleReport = new ReportSimple({ logProvider: console });

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    simpleReport.log({ className, fnKey });
  }
});
\`\`\`

### 6.4 ReportSliceDiff - СЃСЂР°РІРЅРµРЅРёРµ РїСЂРѕС…РѕРґРѕРІ

\`\`\`javascript
const diffReport = new ReportSliceDiff({
  tracer: Tracer,
  sliceName: 'comparison',
  startPredicate: (event) => event.fullName === 'TargetFunction',
  endPredicate: (event) => event.fullName === 'TargetFunction' && event.place === 'after'
});

diffReport.start();
await targetFunction();
diffReport.stop();

diffReport.start();
await targetFunction();
diffReport.stop();

const diffs = diffReport.getDiffs();
diffs.forEach(diff => {
  if (diff.changed.args) {
    console.log(\`РђСЂРіСѓРјРµРЅС‚С‹ РёР·РјРµРЅРёР»РёСЃСЊ РІ \${diff.next.fullName}\`);
  }
});
\`\`\`

### 6.5 ReportSliceUsage - РїРѕР»РЅР°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР°

\`\`\`javascript
const sliceUsage = new ReportSliceUsage({
  tracer: Tracer,
  sliceName: 'mySlice',
  startPredicate: (event) => event.fullName === 'TargetFunction',
  endPredicate: (event) => event.fullName === 'TargetFunction' && event.place === 'after'
});

sliceUsage.start();
await targetFunction();
sliceUsage.stop();

const run = sliceUsage.getLastRun();
console.log(\`РљР»Р°СЃСЃС‹: \${run.classes.join(', ')}\`);
console.log(\`РњРµС‚РѕРґС‹: \${run.methods.join(', ')}\`);
console.log(\`РЎРѕР±С‹С‚РёР№: \${run.eventsCount}\`);

const diffs = sliceUsage.getAdjacentDiffs();
diffs.forEach(diff => {
  console.log(\`РќРѕРІС‹Рµ РјРµС‚РѕРґС‹: \${diff.methods.added}\`);
});
\`\`\`

### 6.6 РЎСЂР°РІРЅРµРЅРёРµ РѕС‚С‡РµС‚РѕРІ

| РћС‚С‡РµС‚ | Р§С‚Рѕ РґРµР»Р°РµС‚ | Р РµР·СѓР»СЊС‚Р°С‚ |
|-------|------------|-----------|
| ReportUsage | РЎС‡РµС‚С‡РёРє РІС‹Р·РѕРІРѕРІ | \`Class.method: N СЂР°Р·\` |
| ReportTreeView | РЎС‚СЂСѓРєС‚СѓСЂР° РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё | Р”РµСЂРµРІРѕ СЃ РѕС‚СЃС‚СѓРїР°РјРё |
| ReportSimple | РџР»РѕСЃРєРёР№ СЃРїРёСЃРѕРє | РЈРЅРёРєР°Р»СЊРЅС‹Рµ РІС‹Р·РѕРІС‹ |
| ReportSliceDiff | РЎСЂР°РІРЅРµРЅРёРµ РїСЂРѕС…РѕРґРѕРІ | РР·РјРµРЅРµРЅРёСЏ РјРµР¶РґСѓ РІС‹Р·РѕРІР°РјРё |
| ReportSliceUsage | РџРѕР»РЅР°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР° | РЎРїРёСЃРєРё РєР»Р°СЃСЃРѕРІ, РјРµС‚РѕРґРѕРІ, СЃРІРѕР№СЃС‚РІ |

---

## 7. Р¤РёР»СЊС‚СЂР°С†РёСЏ С€СѓРјР°

### 7.1 Р§С‚Рѕ С‚Р°РєРѕРµ С€СѓРј?

Р’С‹Р·РѕРІС‹, РєРѕС‚РѕСЂС‹Рµ РїСЂРѕРёСЃС…РѕРґСЏС‚ С‡Р°СЃС‚Рѕ Рё Р·Р°СЃРѕСЂСЏСЋС‚ Р»РѕРіРё:
- \`onTimerScroll\` (60 СЂР°Р·/СЃРµРє)
- \`_animation\` (60 СЂР°Р·/СЃРµРє)
- \`_autoSave\`
- \`Logger.log\`

### 7.2 NoisyCalls - РёСЃРєР»СЋС‡РµРЅРёРµ РІС‹Р·РѕРІРѕРІ

\`\`\`javascript
Tracer.configureTracing({
  suppressNoisy: true,
  noisyCalls: [
    'CEditorPage.onTimerScroll',
    'PaintMessageLoop._animation',
    'baseEditorsApi._autoSave'
  ]
});
\`\`\`

### 7.3 NoisyProperties - РёСЃРєР»СЋС‡РµРЅРёРµ СЃРІРѕР№СЃС‚РІ

\`\`\`javascript
Tracer.configureTracing({
  suppressNoisy: true,
  noisyProperties: [
    'Component._internal',
    'Cache._timestamp'
  ]
});
\`\`\`

### 7.4 CallFilter - РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєР°СЏ С„РёР»СЊС‚СЂР°С†РёСЏ

\`\`\`javascript
Tracer.configureTracing({
  callFilter: ({ fullName, className, fnKey }) => {
    // РўРѕР»СЊРєРѕ РјРµС‚РѕРґС‹ СЃРµСЂРІРёСЃРѕРІ
    return fullName.includes('Service') || fullName.includes('Repository');
  }
});
\`\`\`

### 7.5 PropertyFilter - РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєР°СЏ С„РёР»СЊС‚СЂР°С†РёСЏ

\`\`\`javascript
Tracer.configureTracing({
  propertyFilter: ({ phase, propName, className }) => {
    if (propName.startsWith('_')) return false;
    if (phase === 'get') return false;
    return true;
  }
});
\`\`\`

### 7.6 РџРѕСЂСЏРґРѕРє РїСЂРёРјРµРЅРµРЅРёСЏ С„РёР»СЊС‚СЂРѕРІ

\`\`\`
1. noisyCalls / noisyProperties (РїРѕР»РЅРѕРµ РёСЃРєР»СЋС‡РµРЅРёРµ)
   v
2. callFilter / propertyFilter (РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєР°СЏ Р»РѕРіРёРєР°)
   v
3. РЎРѕР±С‹С‚РёРµ РїРµСЂРµРґР°РµС‚СЃСЏ РІ СЃР»Р°Р№СЃС‹
   v
4. traceBySlice РїРѕР»СѓС‡Р°РµС‚ СЃРѕР±С‹С‚РёРµ (РµСЃР»Рё СЃР»Р°Р№СЃ Р°РєС‚РёРІРµРЅ)
\`\`\`

---

## 8. API Reference

### 8.1 РћСЃРЅРѕРІРЅС‹Рµ РјРµС‚РѕРґС‹ Tracer

```javascript
// РќР°Р±Р»СЋРґРµРЅРёРµ С„СѓРЅРєС†РёР№ Рё РєР»Р°СЃСЃРѕРІ
Tracer.createProxyFn(targetFn, eventName, className?);
Tracer.observeConstructor(classCtor, className?);
Tracer.observe(target, targetName?);
Tracer.observePrototype(classCtor, className?);
Tracer.observeAll(targetList);
Tracer.observePrototypeAll(targetList);

// РќР°Р±Р»СЋРґРµРЅРёРµ СЃРІРѕР№СЃС‚РІ
Tracer.observeProperties(target, options);

// РџРѕРґРїРёСЃРєРё РЅР° С‚СЂР°СЃСЃРёСЂРѕРІРєСѓ
Tracer.traceAll(callback);
Tracer.traceCalls(callback);
Tracer.traceProperties(callback);
Tracer.traceProperty(propSelector, callback);
Tracer.traceAllBatched(callback, options);
Tracer.traceCallsBatched(callback, options);
Tracer.tracePropertiesBatched(callback, options);
Tracer.untraceAll();
Tracer.untraceCalls();
Tracer.untraceProperties();

// РЎР»Р°Р№СЃС‹
Tracer.defineSlice(name, config);
Tracer.enableSlice(name);
Tracer.disableSlice(name);
Tracer.disableSliceListeners(name);
Tracer.traceBySlice(name, callback);
Tracer.traceBySliceOnce(name, callback);
Tracer.traceBySliceSequence(sliceSeq, callback);
Tracer.untraceBySlice(name, callback?);
Tracer.getEnabledSlices();
Tracer.getRegisteredSlices();
Tracer.defineSliceByCall(sliceName, target, targetFnName, predicate);
Tracer.defineSliceByFunction(sliceName, fn);

// РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ Рё РѕС‚Р»Р°РґРєР°
Tracer.configure(options);
Tracer.setTraceProfile(profileName, overrides);
Tracer.configureTracing(options);
Tracer.getTraceConfig();
Tracer.logSlice(sliceSelector, ...values);
Tracer.invokeOnSlice(sliceName, fn);
Tracer.getCurrentContext();
Tracer.debugOn(eventName, conditionCallback);
Tracer.debugOnceOn(eventName, conditionCallback);
Tracer.tracerState;
Tracer.reports;
```

### 8.2 РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ С‚СЂР°СЃСЃРёСЂРѕРІРєРё

\`\`\`javascript
Tracer.configureTracing({
  enableCalls: true,
  enableProperties: false,
  suppressNoisy: true,
  noisyCalls: ['Class.method'],
  noisyProperties: ['Class.property'],
  callFilter: ({ fullName, className, fnKey }) => boolean,
  propertyFilter: ({ phase, propName, className }) => boolean,
  captureContext: false
});
\`\`\`

### 8.3 РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ СЃР»Р°Р№СЃР°

\`\`\`javascript
Tracer.defineSlice('sliceName', {
  predicate: (event) => boolean,
  beforeCall: (event) => boolean,
  afterCall: (event) => boolean,
  initial: false,
  description: 'string'
});
\`\`\`

### 8.4 Batch-РїРѕРґРїРёСЃРєРё

\`\`\`javascript
Tracer.traceAllBatched((batch) => {
  console.log(\`РџРѕР»СѓС‡РµРЅРѕ \${batch.length} СЃРѕР±С‹С‚РёР№\`);
  fetch('/api/trace', { method: 'POST', body: JSON.stringify(batch) });
}, { maxBatchSize: 100, flushIntervalMs: 100 });
\`\`\`

---

## 9. РђСЃРёРЅС…СЂРѕРЅРЅР°СЏ С‚СЂР°СЃСЃРёСЂРѕРІРєР°

### 9.1 РќР°СЃС‚СЂРѕР№РєР° РєРѕРЅС‚РµРєСЃС‚Р°

\`\`\`javascript
// Node.js
Tracer.configure({ asyncContext: 'stack' });

// Р‘СЂР°СѓР·РµСЂ (С‚СЂРµР±СѓРµС‚СЃСЏ Zone.js)
Tracer.configure({ asyncContext: 'zone' });
\`\`\`

### 9.2 Р’РєР»СЋС‡РµРЅРёРµ CallId

\`\`\`javascript
Tracer.setTraceProfile('full', { captureContext: true });
// РёР»Рё
Tracer.configureTracing({ captureContext: true });
\`\`\`

### 9.3 РџСЂРёРјРµСЂ Р°СЃРёРЅС…СЂРѕРЅРЅРѕР№ С‚СЂР°СЃСЃРёСЂРѕРІРєРё

\`\`\`javascript
class OrderService {
  async createOrder(items) {
    const validated = await this.validateItems(items);
    const total = await this.calculateTotal(validated);
    return await this.processPayment(total);
  }
  async validateItems(items) { /* ... */ }
  async calculateTotal(items) { /* ... */ }
  async processPayment(amount) { /* ... */ }
}

Tracer.configure({ asyncContext: 'stack' });
Tracer.setTraceProfile('full', { captureContext: true });

Tracer.traceCalls((event) => {
  const arrow = event.place === 'before' ? '>' : '<';
  console.log(\`[\${event.callId}] \${arrow} \${event.fullName}\`);
});
\`\`\`

### 9.4 РџРѕР»СѓС‡РµРЅРёРµ РєРѕРЅС‚РµРєСЃС‚Р°

\`\`\`javascript
const context = Tracer.getCurrentContext();

context.forEach((node) => {
  if (node.val) {
    console.log(\`\${node.val.className}.\${node.val.fnKey}\`);
  }
});

context.trace('Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ');
\`\`\`

---

## 10. РџСЂРѕС„РёР»Рё С‚СЂР°СЃСЃРёСЂРѕРІРєРё

| РџСЂРѕС„РёР»СЊ | enableCalls | enableProperties | suppressNoisy | captureContext |
|---------|-------------|------------------|---------------|----------------|
| minimal | true | false | true | false |
| balanced | true | false | true | false |
| full | true | true | false | true |

\`\`\`javascript
Tracer.setTraceProfile('minimal');
Tracer.setTraceProfile('full');
Tracer.setTraceProfile('balanced', { enableProperties: true });
\`\`\`

---

## 11. РџСЂР°РєС‚РёС‡РµСЃРєРёРµ РїСЂРёРјРµСЂС‹

### 11.1 РџРѕР»РЅС‹Р№ С†РёРєР» РѕС‚Р»Р°РґРєРё

\`\`\`javascript
class ECommerceService {
  async checkout(cartId, paymentMethod) {
    const cart = await this.getCart(cartId);
    const validated = await this.validateCart(cart);
    const total = this.calculateTotal(validated);
    const payment = await this.processPayment(total, paymentMethod);
    return await this.createOrder(cart, payment);
  }
  async getCart(id) { return { items: [] }; }
  async validateCart(cart) { return cart; }
  calculateTotal(items) { return 100; }
  async processPayment(amount, method) { return { success: true }; }
  async createOrder(cart, payment) { return { id: 1 }; }
}

// РќР°СЃС‚СЂРѕР№РєР°
Tracer.configure({ asyncContext: 'stack' });
Tracer.setTraceProfile('balanced');

// РћР±РѕСЂР°С‡РёРІР°РµРј
const TracedService = Tracer.observeConstructor(ECommerceService, 'ECommerceService');
const service = new TracedService();

// РЎР±РѕСЂ СЃС‚Р°С‚РёСЃС‚РёРєРё
const usageReport = new ReportUsage({ logProvider: console });
Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

// РЎР»Р°Р№СЃ РґР»СЏ РґРµС‚Р°Р»СЊРЅРѕРіРѕ Р°РЅР°Р»РёР·Р°
Tracer.defineSlice('checkoutFlow', {
  predicate: (event) => event.fullName === 'ECommerceService.checkout',
  beforeCall: () => console.log('РќРђР§РђР›Рћ РћР¤РћР РњР›Р•РќРРЇ'),
  afterCall: () => console.log('РљРћРќР•Р¦ РћР¤РћР РњР›Р•РќРРЇ')
});

Tracer.traceBySlice('checkoutFlow', (event) => {
  console.log(\`[Checkout] \${event.fullName}\`);
});

await service.checkout('cart123', 'card');
usageReport.print();
\`\`\`

### 11.2 РћС‚СЃР»РµР¶РёРІР°РЅРёРµ РёР·РјРµРЅРµРЅРёСЏ СЃРІРѕР№СЃС‚РІР°

\`\`\`javascript
class Order {
  constructor() { this.status = 'pending'; }
  approve() { this.status = 'approved'; }
  reject() { this.status = 'rejected'; }
}

Tracer.observeProperties(Order.prototype, { name: 'Order', properties: 'status' });

Tracer.traceProperties((event) => {
  if (event.propName === 'status') {
    console.log(\`РЎС‚Р°С‚СѓСЃ: \${event.curValue} > \${event.value}\`);
    console.log(new Error().stack.split('\\n')[3]);
  }
});

const order = new Order();
order.approve();
// Р’С‹РІРѕРґ: РЎС‚Р°С‚СѓСЃ: pending > approved
\`\`\`

### 11.3 Batch-РѕС‚РїСЂР°РІРєР° РІ production

\`\`\`javascript
const batch = [];

Tracer.setTraceProfile('minimal');
Tracer.configureTracing({ suppressNoisy: true });

Tracer.traceAllBatched((events) => {
  batch.push(...events);
}, { maxBatchSize: 50, flushIntervalMs: 5000 });

setInterval(async () => {
  if (batch.length > 0) {
    const events = [...batch];
    batch.length = 0;
    await fetch('/api/trace', { method: 'POST', body: JSON.stringify(events) });
  }
}, 5000);
\`\`\`

### 11.4 РџРѕРёСЃРє С†РµРїРѕС‡РєРё РїСЂРёСЃРІРѕРµРЅРёР№

\`\`\`javascript
class Repository { constructor() { this.data = null; } }
class Service { constructor(repo) { this.repo = repo; } }
class Controller { constructor(svc) { this.svc = svc; } }

Tracer.observeProperties(Repository.prototype, { name: 'Repository', properties: 'data' });

Tracer.defineSlice('dataFlow', {
  predicate: (event) => ['updateData', 'saveData', 'store'].some(m => event.fullName.includes(m)),
  beforeCall: () => true,
  afterCall: () => false
});

const path = [];
Tracer.traceBySlice('dataFlow', (event) => {
  if (event.place === 'before') path.push(event.fullName);
  if (event.eventType === 'propertySet' && event.propName === 'data') {
    console.log('Р¦РµРїРѕС‡РєР°:', path.join(' > '));
    path.length = 0;
  }
});
\`\`\`

---

## 12. Р РµС€РµРЅРёРµ РїСЂРѕР±Р»РµРј

| РџСЂРѕР±Р»РµРјР° | Р РµС€РµРЅРёРµ |
|----------|---------|
| РЎР»Р°Р№СЃ РЅРµ Р°РєС‚РёРІРёСЂСѓРµС‚СЃСЏ | РџСЂРѕРІРµСЂСЊС‚Рµ predicate, РґРѕР±Р°РІСЊС‚Рµ console.log |
| РђСЃРёРЅС…СЂРѕРЅРЅС‹Рµ РІС‹Р·РѕРІС‹ РЅРµ СЃРІСЏР·Р°РЅС‹ | РќР°СЃС‚СЂРѕР№С‚Рµ \`asyncContext: 'stack'\` |
| РЎР»РёС€РєРѕРј РјРЅРѕРіРѕ СЃРѕР±С‹С‚РёР№ | РСЃРїРѕР»СЊР·СѓР№С‚Рµ РїСЂРѕС„РёР»СЊ minimal РёР»Рё batch |
| РЈС‚РµС‡РєР° РїР°РјСЏС‚Рё | Р’С‹Р·С‹РІР°Р№С‚Рµ \`untraceBySlice\` РёР»Рё \`disableSliceListeners\` |
| РќРµС‚ callId РІ СЃРѕР±С‹С‚РёСЏС… | Р’РєР»СЋС‡РёС‚Рµ \`captureContext: true\` |

### РћС‚Р»Р°РґРєР° Tracer

\`\`\`javascript
console.log('РђРєС‚РёРІРЅС‹Рµ СЃР»Р°Р№СЃС‹:', Tracer.getEnabledSlices());
console.log('Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅС‹Рµ:', Tracer.getRegisteredSlices());
console.log('РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ:', Tracer.getTraceConfig());
console.log('РљРѕРЅС‚РµРєСЃС‚:', Tracer.getCurrentContext());
\`\`\`

---

## 13. Р§РµРєР»РёСЃС‚ СЂР°Р·СЂР°Р±РѕС‚С‡РёРєР°

### 13.1 РџРµСЂРµРґ РЅР°С‡Р°Р»РѕРј

\`\`\`markdown
- [ ] РћРїСЂРµРґРµР»РёС‚СЊ С†РµР»СЊ С‚СЂР°СЃСЃРёСЂРѕРІРєРё (Р±Р°Рі, РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ, Р°РЅР°Р»РёР·)
- [ ] Р’С‹Р±СЂР°С‚СЊ РїСЂРѕС„РёР»СЊ (minimal/balanced/full)
- [ ] РќР°СЃС‚СЂРѕРёС‚СЊ Р°СЃРёРЅС…СЂРѕРЅРЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚ РµСЃР»Рё РЅСѓР¶РЅРѕ
- [ ] РћРїСЂРµРґРµР»РёС‚СЊ РЅСѓР¶РЅС‹Рµ СЃР»Р°Р№СЃС‹
\`\`\`

### 13.2 Р’ РїСЂРѕС†РµСЃСЃРµ

\`\`\`markdown
- [ ] РќР°С‡Р°С‚СЊ СЃ ReportUsage
- [ ] Р’РёР·СѓР°Р»РёР·РёСЂРѕРІР°С‚СЊ ReportTreeView
- [ ] РЎСѓР·РёС‚СЊ РґРѕ СЃР»Р°Р№СЃР°
- [ ] РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ debugOn РґР»СЏ РѕСЃС‚Р°РЅРѕРІРєРё
- [ ] РџСЂРёРјРµРЅРёС‚СЊ С„РёР»СЊС‚СЂР°С†РёСЋ С€СѓРјР° РµСЃР»Рё РЅСѓР¶РЅРѕ
\`\`\`

### 13.3 РџРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ

\`\`\`markdown
- [ ] РћС‚РєР»СЋС‡РёС‚СЊ РїРѕРґРїРёСЃРєРё (untraceAll)
- [ ] РћС‡РёСЃС‚РёС‚СЊ СЃР»Р°Р№СЃС‹ (disableSliceListeners)
- [ ] РЎРѕС…СЂР°РЅРёС‚СЊ РѕС‚С‡РµС‚С‹ РґР»СЏ Р°РЅР°Р»РёР·Р°
\`\`\`

---

## 14. РўРёРїРёС‡РЅС‹Рµ РѕС€РёР±РєРё

### ? РќРµ РґРµР»Р°Р№С‚Рµ С‚Р°Рє

\`\`\`javascript
// 1. РўСЏР¶РµР»С‹Рµ РѕРїРµСЂР°С†РёРё РІ predicate
Tracer.defineSlice('slow', {
  predicate: (event) => {
    return JSON.stringify(event).includes('pattern'); // РњРµРґР»РµРЅРЅРѕ!
  }
});

// 2. Р—Р°Р±С‹Р»Рё РѕС‚РїРёСЃР°С‚СЊСЃСЏ
Tracer.traceAll(callback);
// ... РЅРµС‚ РІС‹Р·РѕРІР° Tracer.untraceAll() > СѓС‚РµС‡РєР° РїР°РјСЏС‚Рё


// 4. Р¤РёР»СЊС‚СЂСѓР№С‚Рµ РІРЅСѓС‚СЂРё callback
Tracer.traceBySlice('slice', (event) => {
  if (Tracer.tracerState.get('someSlice')) {
    // РѕР±СЂР°Р±РѕС‚РєР°
  }
});

// 5. Р¤РёРєСЃРёСЂСѓР№С‚Рµ baseline
const baseline = new ReportSliceDiff({...});
baseline.start();
await runWithData(testData);
baseline.stop();
// РїРѕС‚РѕРј СЃСЂР°РІРЅРёРІР°Р№С‚Рµ СЃ С‚РµРј Р¶Рµ testData
\`\`\`

---

## 15. РСЃС‚РѕСЂРёСЏ РёР·РјРµРЅРµРЅРёР№

### 4.3 (2024)
- РћР±СЉРµРґРёРЅРµРЅРёРµ РґРѕРєСѓРјРµРЅС‚Р°С†РёРё РІ РµРґРёРЅС‹Р№ С„Р°Р№Р»
- Р”РѕР±Р°РІР»РµРЅ СЂР°Р·РґРµР» "РўРёРїРёС‡РЅС‹Рµ РѕС€РёР±РєРё"

### 4.2 (2024)
- Р”РѕР±Р°РІР»РµРЅ ReportSliceUsage
- РЈР»СѓС‡С€РµРЅР° С„РёР»СЊС‚СЂР°С†РёСЏ С€СѓРјР°
- Р”РѕР±Р°РІР»РµРЅС‹ batch-РїРѕРґРїРёСЃРєРё

### 4.1 (2024)
- Р”РѕР±Р°РІР»РµРЅС‹ РїСЂРѕС„РёР»Рё С‚СЂР°СЃСЃРёСЂРѕРІРєРё
- Р”РѕР±Р°РІР»РµРЅ captureContext РґР»СЏ Р°СЃРёРЅС…СЂРѕРЅРЅРѕСЃС‚Рё

### 4.0 (2024)
- РџРµСЂРµСЂР°Р±РѕС‚Р°РЅР° Р°СЂС…РёС‚РµРєС‚СѓСЂР° СЃР»Р°Р№СЃРѕРІ
- Р”РѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° Zone.js
- РЈР»СѓС‡С€РµРЅС‹ РѕС‚С‡РµС‚С‹

---

## Р‘С‹СЃС‚СЂР°СЏ С€РїР°СЂРіР°Р»РєР°

\`\`\`javascript
// Р‘Р°Р·РѕРІС‹Рµ РєРѕРјР°РЅРґС‹
Tracer.traceAll(console.log);
Tracer.traceCalls(console.log);
Tracer.traceProperties(console.log);
Tracer.untraceAll();

// РЎР»Р°Р№СЃС‹
Tracer.defineSlice('name', { predicate: (e) => e.fullName === 'target', beforeCall: () => true, afterCall: () => false });
Tracer.traceBySlice('name', callback);
Tracer.enableSlice('name');
Tracer.disableSlice('name');

// РћС‚С‡РµС‚С‹
new ReportUsage({ logProvider: console }).print();
new ReportTreeView().getResults();
new ReportSliceDiff({ tracer: Tracer, startPredicate, endPredicate });
new ReportSliceUsage({ tracer: Tracer, startPredicate, endPredicate });

// РћС‚Р»Р°РґРєР°
Tracer.debugOn('beforeCallMethod', (e) => e.fullName === 'target');
Tracer.observeProperties(obj, { name: 'Class', properties: 'prop' });

// РљРѕРЅС„РёРіСѓСЂР°С†РёСЏ
Tracer.setTraceProfile('minimal');
Tracer.configure({ asyncContext: 'stack' });
Tracer.configureTracing({ suppressNoisy: true, noisyCalls: ['method'] });
\`\`\`

---

**Tracer v4.3 | Р•РґРёРЅР°СЏ РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ**

\`\`\`javascript
// РЎРєР°С‡Р°С‚СЊ: const blob = new Blob([documentation], { type: 'text/markdown' });
// const url = URL.createObjectURL(blob);
// const a = document.createElement('a');
// a.href = url;
// a.download = 'tracer-documentation.md';
// a.click();
\`\`\`
`;

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ СЃРєР°С‡РёРІР°РЅРёСЏ
function downloadDocumentation() {
  const blob = new Blob([mergedDocumentation], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tracer-documentation.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('? Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ СЃРєР°С‡Р°РЅР° РєР°Рє tracer-documentation.md');
}

// Р”Р»СЏ Р±СЂР°СѓР·РµСЂР°
if (typeof window !== 'undefined') {
  window.downloadTracerDocs = downloadDocumentation;
  window.tracerDocumentation = mergedDocumentation;
  console.log('?? РСЃРїРѕР»СЊР·СѓР№С‚Рµ downloadTracerDocs() РґР»СЏ СЃРєР°С‡РёРІР°РЅРёСЏ РґРѕРєСѓРјРµРЅС‚Р°С†РёРё');
}

// Р”Р»СЏ Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergedDocumentation, downloadDocumentation };
}

