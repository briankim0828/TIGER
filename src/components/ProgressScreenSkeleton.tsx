import React from 'react';
import { View, StyleSheet } from 'react-native';
import ShimmerPlaceholder from './ShimmerPlaceholder';

/**
 * Skeleton placeholder that mirrors the real ProgressScreen layout:
 *   1. Greeting text (two lines)
 *   2. Heatmap card
 *   3. Progress graph card
 *   4. CTA button
 */
const ProgressScreenSkeleton: React.FC = () => (
  <View style={styles.root}>
    {/* Matches: VStack space="lg"(20px gap) p="$2"(8px all sides) */}
    <View style={styles.content}>
      {/* Box h={25} spacer */}
      <View style={{ height: 25 }} />

      {/* Greeting block — Box p="$1" (4px padding) */}
      <View style={styles.section}>
        <ShimmerPlaceholder width={220} height={30} borderRadius={6} />
        <ShimmerPlaceholder width={180} height={15} borderRadius={4} style={{ marginTop: 6 }} />
      </View>

      {/* Heatmap card skeleton — WorkoutHeatmap: bg=#12141A py=$3(12) px=$3(12) borderRadius=$lg(12) */}
      <View style={styles.card}>
        {/* Header row: date + split name left, chevron right, mb=$3(12) */}
        <View style={[styles.cardHeader, { marginBottom: 12 }]}>
          <View>
            <ShimmerPlaceholder width={140} height={14} borderRadius={4} />
            <ShimmerPlaceholder width={100} height={18} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
          <ShimmerPlaceholder width={20} height={20} borderRadius={10} />
        </View>
        {/* Grid area */}
        <ShimmerPlaceholder width="100%" height={90} borderRadius={6} />
      </View>

      {/* Progress graph card skeleton — ProgressGraph: bg=#12141A p=12 borderRadius=12 */}
      <View style={styles.card}>
        {/* Title row */}
        <View style={styles.cardHeader}>
          <ShimmerPlaceholder width={130} height={18} borderRadius={4} />
          <ShimmerPlaceholder width={24} height={24} borderRadius={12} />
        </View>
        {/* Chart area */}
        <ShimmerPlaceholder width="100%" height={220} borderRadius={8} style={{ marginTop: 12 }} />
      </View>

      {/* CTA button skeleton */}
      <ShimmerPlaceholder width="100%" height={52} borderRadius={16} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1E2028',
  },
  content: {
    flex: 1,
    padding: 8,          // matches p="$2" (8px all sides)
    gap: 20,             // matches VStack space="lg" (20px between children)
  },
  section: {
    paddingHorizontal: 4,  // matches Box p="$1"
    paddingVertical: 4,
  },
  card: {
    backgroundColor: '#12141A',
    borderRadius: 12,
    paddingVertical: 12,   // matches py="$3"
    paddingHorizontal: 12, // matches px="$3"
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

export default React.memo(ProgressScreenSkeleton);
