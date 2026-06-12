document.addEventListener('DOMContentLoaded', () => {
  const el = id => document.getElementById(id);

  const showResult = (elId, data) => {
    const pre = el(elId);
    pre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  };

  el('btnSim').addEventListener('click', async () => {
    const token = el('adminToken').value.trim();
    const farmer = el('simFarmer').value.trim();
    const lender = el('simLender').value.trim();
    const amount = Number(el('simAmount').value || 0);
    showResult('simResult', 'Sending...');
    try {
      const resp = await fetch('/api/admin/simulate_payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ farmer_id: farmer, lender, amount_kes: amount })
      });
      const json = await resp.text();
      try { showResult('simResult', JSON.parse(json)); } catch(e){ showResult('simResult', json); }
    } catch (err) { showResult('simResult', String(err)); }
  });

  el('btnDec').addEventListener('click', async () => {
    const token = el('decToken').value.trim();
    const id = el('proofId').value.trim();
    showResult('decResult', 'Requesting...');
    try {
      const resp = await fetch('/api/admin/decrypt/' + encodeURIComponent(id), { headers: { 'x-admin-token': token }});
      const txt = await resp.text();
      try { showResult('decResult', JSON.parse(txt)); } catch(e){ showResult('decResult', txt); }
    } catch (err) { showResult('decResult', String(err)); }
  });

});
