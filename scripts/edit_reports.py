import re

with open('src/pages/admin/ReportsAnalytics.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variables for date filter
state_injection = """  const [reportType, setReportType] = useState('Inventory Report');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');"""
content = content.replace("  const [reportType, setReportType] = useState('Inventory Report');", state_injection)

# 2. Add filtering logic for components and requests
filter_injection = """
  const rawComponents = mockEngine.getComponents();
  const rawRequests = mockEngine.getRequests();

  const filterByDate = (items: any[], dateField: string) => {
    if (!appliedFromDate && !appliedToDate) return items;
    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      if (isNaN(itemDate.getTime())) return true;
      
      let pass = true;
      if (appliedFromDate) {
        const from = new Date(appliedFromDate);
        from.setHours(0,0,0,0);
        if (itemDate < from) pass = false;
      }
      if (appliedToDate) {
        const to = new Date(appliedToDate);
        to.setHours(23,59,59,999);
        if (itemDate > to) pass = false;
      }
      return pass;
    });
  };

  const components = filterByDate(rawComponents, 'created_at');
  const requests = filterByDate(rawRequests, 'created_at');

  const getDateRangeText = () => {
    if (!appliedFromDate && !appliedToDate) return 'All Time (First to Latest)';
    const formatDt = (d: string) => {
      const dt = new Date(d);
      return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(dt).replace(/ /g, ' '); // Force exact match format if needed, Intl handles '01 Aug 2026'
    };
    if (appliedFromDate && appliedToDate) {
      return `${formatDt(appliedFromDate)} – ${formatDt(appliedToDate)}`;
    } else if (appliedFromDate) {
      return `From ${formatDt(appliedFromDate)}`;
    } else {
      return `Until ${formatDt(appliedToDate)}`;
    }
  };
  const dateRangeText = getDateRangeText();
"""
content = re.sub(
    r'  const components = mockEngine\.getComponents\(\);\n  const requests = mockEngine\.getRequests\(\);',
    filter_injection,
    content
)

# 3. Modify Stats to use filtered calculated fields
content = content.replace("  const stats = mockEngine.getSystemStats();", "  // stats overridden below")

stats_override = """  const stats = {
    ...mockEngine.getSystemStats(),
    totalComponents: totalUnits,
    availableStock: availableUnits,
    borrowedStock: borrowedUnits
  };"""
content = content.replace("  const outOfStockCount = components.filter((c) => c.available_stock === 0).length;", "  const outOfStockCount = components.filter((c) => c.available_stock === 0).length;\n\n" + stats_override)

# 4. Modify PDF export calls
content = content.replace(
    "generateEnterpriseReportPdf(reportType, components, requests, stats, user?.role || 'admin');",
    "generateEnterpriseReportPdf(reportType, components, requests, stats, user?.role || 'admin', true, dateRangeText);"
)
content = content.replace(
    "generateEnterpriseReportPdf(reportType, components, requests, stats, user?.role || 'admin', false);",
    "generateEnterpriseReportPdf(reportType, components, requests, stats, user?.role || 'admin', false, dateRangeText);"
)

# 5. Modify CSV header
content = content.replace(
    '        csvContent += `Report Type,${reportType}\\n`;',
    '        csvContent += `Report Type,${reportType}\\n`;\n        csvContent += `Date Range,${dateRangeText}\\n`;'
)

# 6. Modify SQL header
content = content.replace(
    '      sqlContent += `-- Report Type: ${reportType}\\n\\n`;',
    '      sqlContent += `-- Report Type: ${reportType}\\n`;\n      sqlContent += `-- Date Range: ${dateRangeText}\\n\\n`;'
)

# 7. Add UI for Date Filters
ui_injection = """
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] text-gray-700 font-bold uppercase mb-1">From Date</label>
            <input 
              type="date" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-xl glass-input text-xs font-semibold text-black"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-700 font-bold uppercase mb-1">To Date</label>
            <input 
              type="date" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-xl glass-input text-xs font-semibold text-black"
            />
          </div>
          <button
            onClick={() => {
              if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
                toast.error("From date cannot be after To date.");
                return;
              }
              setAppliedFromDate(fromDate);
              setAppliedToDate(toDate);
              toast.success("Date filter applied.");
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all"
          >
            Apply Filter
          </button>
          <button
            onClick={() => {
              setFromDate('');
              setToDate('');
              setAppliedFromDate('');
              setAppliedToDate('');
              toast.info("Date filter reset.");
            }}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all"
          >
            Reset
          </button>
        </div>"""

content = content.replace(
    '          </select>\n        </div>\n\n        <div className="flex flex-wrap items-center gap-2">',
    '          </select>\n        </div>\n' + ui_injection + '\n\n        <div className="flex flex-wrap items-center gap-2 w-full justify-end mt-4 md:mt-0 md:w-auto">'
)

# 8. Update Email Notification Text
email_injection = """
      await sendBrevoReportEmail(targetEmail, `${reportType} (${dateRangeText})`, base64Pdf);"""
content = re.sub(r'await sendBrevoReportEmail\(targetEmail, reportType, base64Pdf\);', email_injection.strip(), content)


with open('src/pages/admin/ReportsAnalytics.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Modification complete.")
