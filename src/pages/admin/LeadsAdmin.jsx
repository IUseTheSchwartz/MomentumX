export default function LeadsAdmin() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      setRows(data || []);
    }

    load();
  }, []);

  const columns = [
    { key: 'first_name', label: 'First' },
    { key: 'last_name', label: 'Last' },
    { key: 'lead_type', label: 'Lead Type' },
    { key: 'status', label: 'Status' },
    { key: 'assigned_to', label: 'Assigned To' },
    { key: 'created_at', label: 'Created', render: (v) => formatDate(v) }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Leads</h1>
          <p>Inventory and assigned lead review.</p>
        </div>
      </div>

      <div className="panel glass">
        CSV uploader comes next after the base shell is in place.
      </div>

      <div className="top-gap">
        <DataTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}
