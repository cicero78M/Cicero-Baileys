import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({ query: mockQuery }));

const { absensiRegistrasiDashboardDirektorat } = await import(
  '../src/handler/fetchabsensi/dashboard/absensiRegistrasiDashboardDirektorat.js'
);

test('generates directorate report with sequential operator counts', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('FROM clients')) {
      return {
        rows: [
          { client_id: 'DITA', nama: 'Dit A' },
          { client_id: 'POLRESA', nama: 'Polres A' },
          { client_id: 'POLRESB', nama: 'Polres B' },
        ],
      };
    }
    if (sql.includes('GROUP BY duc.client_id')) {
      return {
        rows: [
          { client_id: 'DITA', operator: 3 },
          { client_id: 'POLRESA', operator: 1 },
        ],
      };
    }
    return { rows: [] };
  });

  const msg = await absensiRegistrasiDashboardDirektorat('dita');

  expect(mockQuery).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('client_status = true'),
    ['DITA']
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('JOIN login_log ll'),
    ['dita', 'DITA', expect.any(Date)]
  );
  expect(msg).toMatch(/DIT A : 3 Dita/);
  expect(msg).toMatch(/Sudah : 1 Polres\n- POLRES A : 1 Dita/);
  expect(msg).toMatch(/Belum : 1 Polres\n- POLRES B/);
});

test('generates report for DITINTELKAM with correct role label', async () => {
  mockQuery.mockImplementation((sql) => {
    if (sql.includes('FROM clients')) {
      return {
        rows: [
          { client_id: 'DITINTELKAM', nama: 'Direktorat Intelkam' },
          { client_id: 'POLRES_BOJONEGORO', nama: 'Polres Bojonegoro' },
          { client_id: 'POLRES_JOMBANG', nama: 'Polres Jombang' },
          { client_id: 'POLRES_KEDIRI', nama: 'Polres Kediri' },
        ],
      };
    }
    if (sql.includes('GROUP BY duc.client_id')) {
      return {
        rows: [
          { client_id: 'DITINTELKAM', operator: 1 },
        ],
      };
    }
    return { rows: [] };
  });

  const msg = await absensiRegistrasiDashboardDirektorat('DITINTELKAM');

  expect(mockQuery).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining('client_status = true'),
    ['DITINTELKAM']
  );
  expect(mockQuery).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining('JOIN login_log ll'),
    ['ditintelkam', 'DITINTELKAM', expect.any(Date)]
  );
  // Should show role label "Ditintelkam" instead of "Operator"
  expect(msg).toMatch(/DIREKTORAT INTELKAM : 1 Ditintelkam/);
  expect(msg).toMatch(/Sudah : 0 Polres/);
  expect(msg).toMatch(/Belum : 3 Polres/);
  expect(msg).toMatch(/POLRES BOJONEGORO/);
  expect(msg).toMatch(/POLRES JOMBANG/);
  expect(msg).toMatch(/POLRES KEDIRI/);
});
