import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useElectric } from '../electric';
import { Box, Text, VStack, HStack, Button, ButtonText, Pressable, ScrollView, Input, InputField, Divider, Spinner } from '@gluestack-ui/themed';

type TableInfoRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

const DebugDatabaseScreen: React.FC = () => {
  const { db } = useElectric();
  const [tables, setTables] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [columns, setColumns] = useState<TableInfoRow[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleTables = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return tables;
    return tables.filter((t) => t.toLowerCase().includes(f));
  }, [tables, filter]);

  const loadTables = useCallback(async () => {
    if (!db) return;
    setError(null);
    try {
      // Exclude SQLite internals
      const result = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      setTables(result.map((r) => r.name));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, [db]);

  const loadTableDetail = useCallback(
    async (table: string) => {
      if (!db) return;
      setLoading(true);
      setError(null);
      try {
        // Columns
        const cols = await db.getAllAsync<TableInfoRow>(`PRAGMA table_info(${table})`);
        setColumns(cols);
        // Rows (recent first by rowid)
        const data = await db.getAllAsync<any>(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT 100`);
        setRows(data);
        setSelected(table);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    },
    [db]
  );

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  // Dangerous: wipe all rows from the selected table
  const wipeSelectedTable = useCallback(async () => {
    if (!db || !selected) return;
    setLoading(true);
    setError(null);
    try {
      await db.execAsync('BEGIN IMMEDIATE');
      await db.runAsync(`DELETE FROM ${selected}`);
      await db.execAsync('COMMIT');
      await loadTableDetail(selected);
    } catch (e: any) {
      try { await db.execAsync('ROLLBACK'); } catch {}
      setError(`Failed to wipe table ${selected}: ` + String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [db, selected, loadTableDetail]);


  return (
    <Box flex={1} bg="#1E2028">
      <VStack space="md" p="$4">
        <Text color="white" fontSize="$xl" fontWeight="bold">Debug: Database Inspector</Text>
        <Text color="$textLight400" fontSize="$sm">Tap a table to view its columns and latest 100 rows.</Text>

        <HStack space="sm" alignItems="center">
          <Input flex={1} size="md" variant="outline" borderColor="$borderDark700">
            <InputField
              placeholder="Filter tables..."
              value={filter}
              onChangeText={setFilter}
              color="$textLight50"
              placeholderTextColor="$textLight600"
            />
          </Input>
          <Button action="secondary" variant="outline" onPress={() => { setFilter(''); void loadTables(); }}>
            <ButtonText>Refresh</ButtonText>
          </Button>
        </HStack>

        {error && (
          <Box bg="$red800" p="$3" borderRadius="$md">
            <Text color="white">{error}</Text>
          </Box>
        )}

        <HStack space="md" alignItems="flex-start" mt="$2">
          {/* Left: tables list */}
          <ScrollView style={{ flex: 1, maxHeight: 280 }}>
            <VStack space="xs">
              {visibleTables.map((t) => (
                <Pressable key={t} onPress={() => void loadTableDetail(t)} $pressed={{ opacity: 0.7 }}>
                  <Box bg={selected === t ? '#2F3340' : '#2A2E38'} p="$3" borderRadius="$md">
                    <Text color="white" fontWeight={selected === t ? '$bold' : '$medium'}>{t}</Text>
                  </Box>
                </Pressable>
              ))}
              {visibleTables.length === 0 && (
                <Text color="$textLight600">No tables found.</Text>
              )}
            </VStack>
          </ScrollView>

          {/* Right: details */}
          <Box flex={2} bg="#2A2E38" p="$3" borderRadius="$md" minHeight={280}>
            {selected ? (
              <VStack space="sm">
                <HStack justifyContent="space-between" alignItems="center" space="sm">
                  <Text color="white" fontSize="$lg" fontWeight="$bold">{selected}</Text>
                  <HStack space="sm">
                    <Button size="sm" action="secondary" variant="outline" onPress={wipeSelectedTable} disabled={loading}>
                      <ButtonText>Wipe Table</ButtonText>
                    </Button>
                    <Button size="sm" action="primary" onPress={() => void loadTableDetail(selected)} disabled={loading}>
                      <ButtonText>{loading ? 'Loading...' : 'Reload'}</ButtonText>
                    </Button>
                  </HStack>
                </HStack>

                {/* Columns */}
                <Text color="$textLight400" fontWeight="$semibold">Columns</Text>
                <VStack space="xs">
                  {columns.map((c) => (
                    <HStack key={c.cid} justifyContent="space-between">
                      <Text color="white">{c.name}</Text>
                      <Text color="$textLight500">{c.type}{c.pk ? ' (PK)' : ''}</Text>
                    </HStack>
                  ))}
                  {columns.length === 0 && <Text color="$textLight600">No column info.</Text>}
                </VStack>

                <Divider bg="$borderDark700" my="$2" />

                {/* Rows */}
                <Text color="$textLight400" fontWeight="$semibold" mb="$1">Rows (latest 100)</Text>
                <ScrollView style={{ maxHeight: 360 }}>
                  {loading ? (
                    <HStack alignItems="center" space="sm">
                      <Spinner />
                      <Text color="$textLight400">Loading rows…</Text>
                    </HStack>
                  ) : rows.length > 0 ? (
                    <VStack space="xs">
                      {rows.map((r, idx) => (
                        <Box key={idx} bg="#1E2028" p="$2" borderRadius="$sm">
                          <Text color="#C9D1D9" style={{ fontFamily: 'monospace' }}>{JSON.stringify(r, null, 2)}</Text>
                        </Box>
                      ))}
                    </VStack>
                  ) : (
                    <Text color="$textLight600">No rows.</Text>
                  )}
                </ScrollView>
              </VStack>
            ) : (
              <Text color="$textLight600">Select a table to inspect.</Text>
            )}
          </Box>
        </HStack>
      </VStack>
    </Box>
  );
};

export default DebugDatabaseScreen;
