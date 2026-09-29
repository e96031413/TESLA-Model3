import type { Part, Subsystem, SystemInfo } from './types';

export const SYSTEMS: SystemInfo[] = [
  { id: 'exterior', name: '外觀', english: 'Exterior', color: '#72b7e5' },
  { id: 'body', name: '車體與安全', english: 'Body & Safety', color: '#a6b0c3' },
  { id: 'powertrain', name: '動力與熱管理', english: 'Powertrain & Thermal', color: '#edab64' },
  { id: 'chassis', name: '底盤', english: 'Chassis', color: '#9ed5b5' },
  { id: 'interior', name: '座艙', english: 'Interior', color: '#c9a8de' },
  { id: 'adas', name: '駕駛輔助', english: 'Driver Assistance', color: '#f0d47d' },
];

// Material and construction labels are illustrative visualization cues, not a BOM.
type Row = [string, string, string, Subsystem, string, string, string?];
const rows: Row[] = [
  ['body-shell', '車身外殼', 'Body shell', 'exterior', '金屬面板（示意）', '外觀包絡面；曲面與板件分割為視覺示意。', '車長 4,720 mm；不含後視鏡車寬 1,850 mm；車高 1,440 mm（Tesla 2024+ 長續航規格，選配可異）'],
  ['hood', '前行李廂蓋', 'Hood', 'exterior', '金屬面板（示意）', '覆蓋前行李廂的活動面板。'],
  ['trunk', '後行李廂蓋', 'Trunk lid', 'exterior', '金屬面板（示意）', '後方置物空間的活動面板。'],
  ['door-fl', '左前車門', 'Front left door', 'exterior', '金屬與玻璃（示意）', '左前乘員進出開口。'],
  ['door-fr', '右前車門', 'Front right door', 'exterior', '金屬與玻璃（示意）', '右前乘員進出開口。'],
  ['door-rl', '左後車門', 'Rear left door', 'exterior', '金屬與玻璃（示意）', '左後乘員進出開口。'],
  ['door-rr', '右後車門', 'Rear right door', 'exterior', '金屬與玻璃（示意）', '右後乘員進出開口。'],
  ['glazing', '車窗與天窗', 'Glazing', 'exterior', '玻璃（示意）', '透明外殼與採光區域。'],
  ['headlights', '頭燈', 'Headlights', 'exterior', '聚合物與光學件（示意）', '前方照明組件。'],
  ['taillights', '尾燈', 'Taillights', 'exterior', '聚合物與光學件（示意）', '後方燈具組件。'],
  ['charge-port', '充電埠', 'Charge port', 'exterior', '聚合物與導體（示意）', '高壓電池外部充電介面。'],
  ['wheel-fl', '左前車輪', 'Front left wheel', 'chassis', '橡膠與金屬（示意）', '左前輪胎與輪圈視覺總成。'],
  ['wheel-fr', '右前車輪', 'Front right wheel', 'chassis', '橡膠與金屬（示意）', '右前輪胎與輪圈視覺總成。'],
  ['wheel-rl', '左後車輪', 'Rear left wheel', 'chassis', '橡膠與金屬（示意）', '左後輪胎與輪圈視覺總成。'],
  ['wheel-rr', '右後車輪', 'Rear right wheel', 'chassis', '橡膠與金屬（示意）', '右後輪胎與輪圈視覺總成。'],
  ['frame', '車體結構', 'Body structure', 'body', '金屬結構（示意）', '承載車身與主要組件的結構視覺化。'],
  ['crash-front', '前吸能區', 'Front crash zone', 'body', '金屬結構（示意）', '前方碰撞吸能路徑示意；未經碰撞分析。'],
  ['crash-rear', '後吸能區', 'Rear crash zone', 'body', '金屬結構（示意）', '後方碰撞吸能路徑示意；未經碰撞分析。'],
  ['b-pillars', 'B 柱', 'B-pillars', 'body', '金屬結構（示意）', '前後車門間的車體支柱。'],
  ['battery-pack', '高壓電池包', 'High-voltage battery pack', 'powertrain', '封裝外殼（示意）', '底部高壓儲能總成；容量與內部布局非車廠確認。'],
  ['battery-cells', '電芯視覺陣列', 'Battery cell visual array', 'powertrain', '電芯（示意）', '僅顯示一種可配置的圓柱電芯外觀；非車輛實際化學體系或尺寸證明。'],
  ['battery-cooling', '電池冷卻通道', 'Battery cooling channels', 'powertrain', '冷卻管路（示意）', '熱交換流向示意；粒子動畫不是 CFD 計算。'],
  ['bms', '電池管理系統', 'Battery management system', 'powertrain', '電子模組（示意）', '電池狀態監控與保護功能示意。'],
  ['pdu', '高壓配電單元', 'Power distribution unit', 'powertrain', '電子與導體（示意）', '高壓電力分配功能示意。'],
  ['motor-front', '前驅動馬達', 'Front drive motor', 'powertrain', '金屬與電磁件（示意）', '雙馬達車型的前驅動單元；Tesla 文件列為感應馬達。'],
  ['motor-rear', '後驅動馬達', 'Rear drive motor', 'powertrain', '金屬與電磁件（示意）', '後驅動單元；Tesla 文件列為永磁同步馬達。'],
  ['inverter', '逆變器', 'Inverter', 'powertrain', '功率電子（示意）', '馬達驅動電力轉換功能示意。'],
  ['octovalve', '熱管理閥組', 'Thermal valve assembly', 'powertrain', '閥體與管路（示意）', '熱泵系統流路概念示意；形狀與配管未經車廠驗證。'],
  ['radiator', '散熱器', 'Radiator', 'powertrain', '金屬熱交換器（示意）', '車輛冷卻迴路的散熱視覺元件。'],
  ['suspension-front', '前懸吊', 'Front suspension', 'chassis', '金屬與阻尼件（示意）', '前輪導向與吸震視覺總成。'],
  ['suspension-rear', '後懸吊', 'Rear suspension', 'chassis', '金屬與阻尼件（示意）', '後輪導向與吸震視覺總成。'],
  ['steering-rack', '轉向齒條', 'Steering rack', 'chassis', '金屬機構（示意）', '前輪轉向連桿的簡化視覺表示。'],
  ['brakes', '摩擦煞車', 'Friction brakes', 'chassis', '金屬與摩擦材（示意）', '摩擦煞車總成；再生煞車由驅動馬達提供，非卡鉗發電。'],
  ['dashboard', '儀表臺', 'Dashboard', 'interior', '聚合物與飾材（示意）', '座艙前方飾板。'],
  ['touchscreen', '中央觸控螢幕', 'Center touchscreen', 'interior', '玻璃與電子件（示意）', '主要人機介面顯示區。'],
  ['steering-wheel', '方向盤', 'Steering wheel', 'interior', '複合材（示意）', '駕駛轉向輸入介面。'],
  ['seat-front', '前座椅', 'Front seats', 'interior', '泡棉與飾材（示意）', '前排乘員座椅。'],
  ['seat-rear', '後座椅', 'Rear seats', 'interior', '泡棉與飾材（示意）', '後排乘員座椅。'],
  ['airbags', '安全氣囊', 'Airbags', 'body', '織物與充氣模組（示意）', '被動安全系統的位置概念；非實際展開模擬。'],
  ['fsd-computer', '駕駛輔助電腦', 'Driver assistance computer', 'adas', '電子模組（示意）', '感測與駕駛輔助運算模組示意；硬體代次依製造日期與配置而異。'],
  ['cameras', '車載攝影機', 'Vehicle cameras', 'adas', '光學與電子件（示意）', '視覺感測器位置概念；數量與配置應以個別車輛為準。'],
  ['hv-harness', '高壓線束', 'High-voltage harness', 'powertrain', '絕緣導體（示意）', '高壓組件連接路徑示意；不可用於維修。'],
  ['lv-harness', '低壓線束', 'Low-voltage harness', 'body', '絕緣導體（示意）', '車身電子設備連接路徑示意。'],
];

// Specific visual assemblies and their display parameters. None is a production BOM or measured tolerance.
type Detail = [material: string, functionNote: string, label1: string, value1: string, label2: string, value2: string];
const details: Record<string, Detail> = {
  'body-shell': ['沖壓鋼／鋁板視覺材（示意）', '表面只對齊公開車輛包絡尺寸；接縫不代表沖壓模具或鈑金公差。', '模型類型', '外觀包絡面示意', '表面工法', '板件拼接示意'],
  hood: ['沖壓薄板與鉸鏈視覺材（示意）', '以前緣鉸接動畫呈現前行李廂開啟，未模擬鎖扣與密封。', '展示機構', '前行李廂開合', '安裝資料', '鉸點與間隙為示意'],
  trunk: ['沖壓薄板與鉸鏈視覺材（示意）', '後蓋沿簡化轉軸開啟，未計入氣壓桿與實際載荷。', '展示機構', '後行李廂開合', '安裝資料', '鉸點與間隙為示意'],
  'door-fl': ['薄板、玻璃與密封條視覺材（示意）', '左前門以剛體旋轉展示進出路徑，省略窗框與碰撞限制。', '位置', '左前', '運動', '單軸開門示意'],
  'door-fr': ['薄板、玻璃與密封條視覺材（示意）', '右前門以剛體旋轉展示進出路徑，省略窗框與碰撞限制。', '位置', '右前', '運動', '單軸開門示意'],
  'door-rl': ['薄板、玻璃與密封條視覺材（示意）', '左後門以剛體旋轉展示進出路徑，省略窗框與碰撞限制。', '位置', '左後', '運動', '單軸開門示意'],
  'door-rr': ['薄板、玻璃與密封條視覺材（示意）', '右後門以剛體旋轉展示進出路徑，省略窗框與碰撞限制。', '位置', '右後', '運動', '單軸開門示意'],
  glazing: ['層壓玻璃外觀材（示意）', '透明面用於看見座艙與車頂；不含玻璃厚度、鍍膜或破裂分析。', '展示範圍', '車窗與頂部玻璃', '光學', '透明度為渲染設定'],
  headlights: ['透明罩與 LED 光源視覺材（示意）', '以發光材質辨識前燈位置，光束不代表法規配光。', '用途', '前方照明位置', '光學', '非實測配光'],
  taillights: ['著色罩與 LED 光源視覺材（示意）', '以發光材質辨識後燈位置，省略燈號控制與法規亮度。', '用途', '後方識別位置', '光學', '非實測亮度'],
  'charge-port': ['絕緣殼與金屬端子視覺材（示意）', '顯示外部充電接入點；插座尺寸和電氣安全不能據此施工。', '系統', '高壓充電入口', '展示機構', '充電蓋開合'],
  'wheel-fl': ['橡膠胎體與鑄造輪圈視覺材（示意）', '左前輪隨車速旋轉並隨轉向改變路輪角。', '輪圈展示', '18 吋外觀假設', '物理滾動半徑', '0.335 m 假設'],
  'wheel-fr': ['橡膠胎體與鑄造輪圈視覺材（示意）', '右前輪隨車速旋轉並隨轉向改變路輪角。', '輪圈展示', '18 吋外觀假設', '物理滾動半徑', '0.335 m 假設'],
  'wheel-rl': ['橡膠胎體與鑄造輪圈視覺材（示意）', '左後輪隨車速旋轉；未計輪胎滑移與載重變形。', '輪圈展示', '18 吋外觀假設', '物理滾動半徑', '0.335 m 假設'],
  'wheel-rr': ['橡膠胎體與鑄造輪圈視覺材（示意）', '右後輪隨車速旋轉；未計輪胎滑移與載重變形。', '輪圈展示', '18 吋外觀假設', '物理滾動半徑', '0.335 m 假設'],
  frame: ['沖壓與焊接結構視覺材（示意）', '標示車身載荷路徑概念，未使用 Tesla 結構圖或強度資料。', '結構', '座艙承載框架示意', '驗證', '未做有限元素分析'],
  'crash-front': ['可壓潰薄壁構件視覺材（示意）', '前方吸能區只表現位置，不預測碰撞脈衝或乘員保護。', '位置', '前縱向吸能區', '驗證', '非碰撞認證模型'],
  'crash-rear': ['可壓潰薄壁構件視覺材（示意）', '後方吸能區只表現位置，不套用其他車型壓鑄件。', '位置', '後縱向吸能區', '驗證', '非碰撞認證模型'],
  'b-pillars': ['成形高強度板材視覺材（示意）', '展示側門間支柱與側面保護概念，未指定鋼種與截面。', '位置', '左右 B 柱', '驗證', '截面與強度未校核'],
  'battery-pack': ['金屬封裝箱與絕緣層視覺材（示意）', '底盤下方電池包為抽象容量來源，非真實模組切面。', '可用能量', '75 kWh 教學假設', '模型', '單一等效電池包'],
  'battery-cells': ['圓柱金屬殼與絕緣層視覺材（示意）', '圓柱陣列只是可配置展示；不代表特定電芯數、化學體系或同時使用 LFP/2170。', '顯示形狀', '圓柱電芯示意', '電芯數／化學', '未標定'],
  'battery-cooling': ['液冷通道與管接頭視覺材（示意）', '流動粒子傳達熱量搬運方向，未解流量、壓降或電芯溫差。', '展示流路', '電池液冷概念', '求解', '無 CFD／熱傳校準'],
  bms: ['PCB、感測與連接器視覺材（示意）', '展示電芯狀態監控與保護邏輯角色；不模擬實車接觸器或均衡策略。', '監控量', 'SOC／溫度概念', '控制', '無原廠 BMS 韌體'],
  pdu: ['匯流排與絕緣殼視覺材（示意）', '顯示高壓分配到驅動與熱系統的拓樸概念，無可用電氣圖。', '輸入', '高壓電池', '輸出', '驅動／輔助支路示意'],
  'motor-front': ['疊片鐵心、繞組與殼體視覺材（示意）', '前感應馬達依 Tesla AWD 架構定位；力矩曲線未依車型校準。', '型式', '前感應馬達（官方類別）', '傳動比', '9:1 模型假設'],
  'motor-rear': ['疊片鐵心、永磁轉子與殼體視覺材（示意）', '後永磁同步馬達依 Tesla AWD 架構定位；再生回充由馬達而非卡鉗提供。', '型式', '後永磁同步（官方類別）', '傳動比', '9:1 模型假設'],
  inverter: ['功率半導體與散熱底板視覺材（示意）', '將電池直流電與馬達交流電的轉換關係視覺化；不含開關損耗圖。', '能量路徑', '電池 DC ↔ 馬達 AC', '額定值', '未按車型標定'],
  octovalve: ['閥體、密封件與冷卻管路視覺材（示意）', '熱管理閥組只表達多迴路切換概念，埠數與管路不等於實車。', '功能', '熱管理流路切換', '流體求解', '無 CFD'],
  radiator: ['金屬翅片與集管視覺材（示意）', '表示冷卻液向空氣排熱的路徑；面積與換熱效率未校準。', '介質', '液體／空氣換熱概念', '性能', '無換熱係數校準'],
  'suspension-front': ['鍛造連桿、彈簧與阻尼器視覺材（示意）', '按公開前雙 A 臂型式建立視覺拓樸，不求解輪位移與襯套柔度。', '拓樸', '前雙 A 臂（官方類別）', '求解', '無懸吊運動學'],
  'suspension-rear': ['成形連桿、彈簧與阻尼器視覺材（示意）', '按公開後多連桿型式建立視覺拓樸，不求解側偏與束角變化。', '拓樸', '後多連桿（官方類別）', '求解', '無懸吊運動學'],
  'steering-rack': ['齒條、拉桿與電動輔助視覺材（示意）', '以前軸 Ackermann 幾何連動左右路輪，未模擬真實轉向比或輪胎側偏。', '軸距', '2.875 m 官方參考', '轉向', '理想 Ackermann 示意'],
  brakes: ['通風碟盤、卡鉗與摩擦片視覺材（示意）', '卡鉗提供未回收的減速力；模型的負電功率來自驅動馬達回充。', '作用', '摩擦減速／停車', '回充', '馬達提供；非卡鉗發電'],
  dashboard: ['射出飾板與軟質覆層視覺材（示意）', '標示座艙橫向配置，省略空調風道與固定點。', '位置', '前座艙橫向面板', '設計', '非實車裝配圖'],
  touchscreen: ['玻璃面板與顯示模組視覺材（示意）', '表達中央人機介面位置，不模擬系統功能或顯示器電氣規格。', '位置', '座艙中央', '互動', '展示介面示意'],
  'steering-wheel': ['成形骨架與包覆材視覺材（示意）', '方向盤外觀隨控制量旋轉，但控制量在物理模型視為路輪角。', '用途', '轉向輸入展示', '模型映射', '控制量＝路輪角'],
  'seat-front': ['金屬座架、泡棉與表皮視覺材（示意）', '前排乘坐位置可視化，不含滑軌、約束與人體工學驗證。', '佈局', '左右前座', '驗證', '無人體工學校核'],
  'seat-rear': ['金屬座架、泡棉與表皮視覺材（示意）', '後排乘坐區域可視化，不含骨架強度與固定點資料。', '佈局', '後排座椅', '驗證', '無固定點校核'],
  airbags: ['織物氣囊與充氣模組視覺材（示意）', '只標示被動防護系統區域，不計算展開時序或傷害指標。', '功能', '被動防護位置概念', '驗證', '非展開／傷害模擬'],
  'fsd-computer': ['PCB、散熱器與外殼視覺材（示意）', '表示攝影機資料處理節點；硬體代次需依個別車輛確認。', '輸入', '攝影機訊號概念', '版本', '未指定 HW3／HW4'],
  cameras: ['鏡頭、感測器與外殼視覺材（示意）', '表示周邊視覺感測方向；鏡頭數量與標定不能由模型推得。', '功能', '外部視覺感測', '標定', '無相機內外參'],
  'hv-harness': ['橘色絕緣層與導體視覺材（示意）', '標示高壓電路的大致區域，路徑與隔離距離不能用於維修。', '系統', '高壓配電路徑', '安全', '非維修線路圖'],
  'lv-harness': ['絕緣導線與接頭視覺材（示意）', '標示低壓控制與資訊連接概念，沒有線徑或接腳配置。', '系統', '低壓訊號／供電', '細節', '無線徑與腳位資料'],
};

const codePrefix: Record<Subsystem, string> = {
  exterior: 'EXT', body: 'BDY', powertrain: 'PWR', chassis: 'CHS', interior: 'INT', adas: 'ADS',
};
const codeCounts: Record<Subsystem, number> = { exterior: 0, body: 0, powertrain: 0, chassis: 0, interior: 0, adas: 0 };

export const PARTS: Part[] = rows.map(([id, name, english, system, , description, dimension]) => {
  const [material, functionNote, label1, value1, label2, value2] = details[id];
  const code = `${codePrefix[system]}-${String(++codeCounts[system]).padStart(3, '0')}`;
  return {
  id,
  name,
  english,
  code,
  system,
  material,
  description: `${description}${functionNote}`,
  specs: [
    { label: label1, value: value1 },
    { label: label2, value: value2 },
    ...(dimension ? [{ label: '參考尺寸', value: dimension }] : []),
  ],
  provenance: 'illustrative',
  };
});
