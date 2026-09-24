s=open('/tmp/prev.tsx').read()
def R(a,b):
  global s
  assert s.count(a)==1,a[:60]; s=s.replace(a,b)
R('import { AdminLayout }','import { useAuth } from "@/lib/auth";\nimport { AdminLayout }')
R('export function PremiumDashboard(){','export function PremiumDashboard(){const {isSuperAdmin,isAdmin,permissions}=useAuth();const can=(k:string)=>isSuperAdmin||isAdmin||(permissions as any)?.[k]!==false;')
R('<TodayVisitorsCard today={r.todayVisitors} processing={Number(processingCount)}/>','{can("dash_visitors")&&<TodayVisitorsCard today={r.todayVisitors} processing={Number(processingCount)}/>}')
R('<PipelineCard data={r.webOrders} title="Web Orders" accent="indigo"/>','{can("dash_web_orders")&&<PipelineCard data={r.webOrders} title="Web Orders" accent="indigo"/>}')
R('<PipelineCard data={r.incompleteOrders} title="Incomplete Orders" accent="violet"/>','{can("dash_incomplete")&&<PipelineCard data={r.incompleteOrders} title="Incomplete Orders" accent="violet"/>}')
R('<ConfirmedSalesProfitCard data={r.profit}/>','{can("dash_confirmed_sales")&&<ConfirmedSalesProfitCard data={r.profit}/>}')
R('<Card title="Stock Alerts"','{can("dash_stock_alerts")&&<Card title="Stock Alerts"')
R('tone="border-orange-100"/><MetaAdsResultCard range={range}/>','tone="border-orange-100"/>}{can("dash_ads")&&<MetaAdsResultCard range={range}/>}')
R('<Section title="Top Selling Products','{can("dash_top_selling")&&<Section title="Top Selling Products')
R('</Section><Section title="Employee Confirmation','</Section>}{can("dash_employee_perf")&&<Section title="Employee Confirmation')
R('</Section></div><div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]"><Section title="Stock Control">','</Section>}</div><div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">{can("dash_stock_control")&&<Section title="Stock Control">')
R('</Section><Section title="Hourly','</Section>}{can("dash_hourly")&&<Section title="Hourly')
i=s.index('title="Hourly'); j=s.index('</Section>',i); s=s[:j+10]+'}'+s[j+10:]
open('src/components/admin/PremiumDashboard.tsx','w').write(s)
