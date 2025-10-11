import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, Pressable, HStack, Icon, VStack } from '@gluestack-ui/themed';
import { AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ScrollView } from 'react-native-gesture-handler';
import WorkoutCalendar from '../components/WorkoutCalendar';
import type { ProgramSplit, WorkoutCalendarEntry } from '../types/ui';
import type { WeekDay } from '../types/base';
import { useDatabase, useWorkoutHistory } from '../db/queries';
import { useWorkout } from '../contexts/WorkoutContext';
import { useOverlay } from '../contexts/OverlayContext';
import { supabase } from '../utils/supabaseClient';

const CalendarScreen: React.FC = () => {
	const navigation = useNavigation<any>();
	const db = useDatabase();
	const history = useWorkoutHistory();
	const { startWorkout } = useWorkout();
	const { showSessionSummary, showWorkoutSummary } = useOverlay();

	const [authUserId, setAuthUserId] = useState<string | null>(null);
	useEffect(() => {
		(async () => {
			try {
				const { data: { user } } = await supabase.auth.getUser();
				setAuthUserId(user?.id ?? null);
			} catch {}
		})();
	}, []);

	const today = new Date();
	const todayYmd = useMemo(() => {
		const y = today.getFullYear();
		const m = String(today.getMonth() + 1).padStart(2, '0');
		const d = String(today.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}, [today]);

	const [splits, setSplits] = useState<ProgramSplit[]>([]);
	const [entries, setEntries] = useState<WorkoutCalendarEntry[]>([]);
	const [posts, setPosts] = useState<Array<{
		sessionId: string;
		sessionName: string | null;
		note: string | null;
		durationMin: number | null;
		totalVolumeKg: number | null;
		startedAt: string | null;
		finishedAt: string | null;
		exercises: Array<{ name: string; setCount: number }>;
	}>>([]);
	const [selectedDate, setSelectedDate] = useState<string | null>(null);

	// Fetch data
	useEffect(() => {
		let canceled = false;
		(async () => {
			try {
				if (!authUserId) { setSplits([]); setEntries([]); setPosts([]); return; }
				const [rows, dayAssigns] = await Promise.all([
					db.getUserSplitsWithExerciseCounts(authUserId),
					db.getDayAssignments(authUserId),
				]);
				const daysBySplit = new Map<string, WeekDay[]>();
				const NUM_TO_LABEL: Record<number, WeekDay> = { 0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun' } as const;
				for (const a of dayAssigns as Array<{ weekday: number | string; split_id: string }>) {
					const list = daysBySplit.get(a.split_id) ?? [];
					const n = typeof a.weekday === 'string' ? parseInt(a.weekday, 10) : (a.weekday as number);
					const label = NUM_TO_LABEL[n as keyof typeof NUM_TO_LABEL];
					if (label) list.push(label);
					daysBySplit.set(a.split_id, list);
				}
				const calendarSplits: ProgramSplit[] = rows.map((r: any) => ({
					id: r.id,
					name: r.name,
					color: r.color ?? undefined,
					days: daysBySplit.get(r.id) ?? [],
					exerciseCount: typeof r.exerciseCount === 'number' ? r.exerciseCount : (typeof r.exercise_count === 'string' ? parseInt(r.exercise_count, 10) : (r.exercise_count ?? 0)),
				}));
				if (canceled) return;
				setSplits(calendarSplits);
				const uid = authUserId as string;
				const [cal, feed] = await Promise.all([
					history.getWorkoutCalendarEntries(uid),
					history.getWorkoutPosts(uid, 200),
				]);
				if (canceled) return;
				setEntries(cal);
				setPosts(feed.map(p => ({
					sessionId: p.sessionId,
					sessionName: p.sessionName,
					note: p.note,
					durationMin: p.durationMin,
					totalVolumeKg: p.totalVolumeKg,
					startedAt: p.startedAt,
					finishedAt: p.finishedAt,
					exercises: p.exercises.map(e => ({ name: e.name, setCount: e.setCount })),
				})));
			} catch (e) {
				setSplits([]); setEntries([]); setPosts([]);
			}
		})();
		return () => { canceled = true; };
	}, [authUserId, db, history]);

	// Month list: current month and previous 5
	const months = useMemo(() => {
		const list: Array<{ year: number; month: number; key: string }> = [];
		let y = today.getFullYear();
		let m = today.getMonth();
		for (let i = 0; i < 6; i++) {
			const key = `${y}-${m}`;
			list.push({ year: y, month: m, key });
			m -= 1;
			if (m < 0) { m = 11; y -= 1; }
		}
		return list; // current first, then older
	}, [today]);

	const entryMap = useMemo(() => new Map(entries.map(e => [e.date, e.completed])), [entries]);

	const getDayOfWeek = useCallback((dateString: string | null) => {
		if (!dateString) return null;
		const [y, m, d] = dateString.split('-').map((s) => parseInt(s, 10));
		if (!y || !m || !d) return null;
		const date = new Date(y, m - 1, d);
		const labels: WeekDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as any;
		return labels[date.getDay()];
	}, []);

	const getSplitForDate = useCallback((dateString: string | null): ProgramSplit | null => {
		const dow = getDayOfWeek(dateString) as WeekDay | null;
		if (!dow) return null;
		return splits.find(s => s.days.includes(dow)) ?? null;
	}, [splits, getDayOfWeek]);

	const getPostForDate = useCallback((dateString: string | null) => {
		if (!dateString) return null;
		return posts.find(p => (p.startedAt ?? '').slice(0, 10) === dateString) ?? null;
	}, [posts]);

	const formattedDate = useMemo(() => {
		if (!selectedDate) return '';
		try {
			const [y, m, d] = selectedDate.split('-').map(n => parseInt(n, 10));
			const dd = new Date(y, m - 1, d);
			return dd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		} catch { return selectedDate; }
	}, [selectedDate]);

	const ctaKind = useMemo<'today' | 'view' | 'log' | 'hidden'>(() => {
		if (!selectedDate) return 'hidden';
		if (selectedDate === todayYmd) return 'today';
		const post = getPostForDate(selectedDate);
		if (post) return 'view';
		return 'log';
	}, [selectedDate, todayYmd, getPostForDate]);

	const handleCtaPress = useCallback(() => {
		if (!selectedDate) return;
		if (ctaKind === 'today' || ctaKind === 'log') {
			const split = getSplitForDate(selectedDate);
			showSessionSummary({ selectedDate, scheduledSplit: split, onStartWorkout: () => {} });
		} else if (ctaKind === 'view') {
			const post = getPostForDate(selectedDate);
			if (!post) return;
			showWorkoutSummary({
				sessionName: post.sessionName,
				note: post.note,
				durationMin: post.durationMin,
				totalVolumeKg: post.totalVolumeKg,
				startedAtISO: post.startedAt,
				startedAtMs: post.startedAt ? Date.parse(post.startedAt) : undefined,
				exercises: post.exercises.map(e => ({ name: e.name, setCount: e.setCount })),
			});
		}
	}, [ctaKind, selectedDate, getSplitForDate, getPostForDate, showSessionSummary, showWorkoutSummary]);

	const ctaLabel = useMemo(() => {
		if (ctaKind === 'today') return "Begin Today's Workout";
		if (ctaKind === 'view') return `View workout from ${formattedDate}`;
		if (ctaKind === 'log') return `Log workout from ${formattedDate}`;
		return '';
	}, [ctaKind, formattedDate]);

	return (
		<Box flex={1} bg="#1E2028">
			{/* Header */}
			<HStack alignItems="center" px="$3" py="$3" space="sm">
				<Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
					{/* @ts-ignore */}
					<Icon as={AntDesign as any} name="left" color="$white" />
				</Pressable>
				<Text color="$white" fontSize="$xl" fontWeight="$bold">Calendar</Text>
			</HStack>

			{/* Body: tap background to clear selection */}
			<Pressable flex={1} onPress={() => setSelectedDate(null)}>
				<ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 100 }}>
					<VStack space="xl">
						{months.map(({ year, month, key }) => (
							<WorkoutCalendar
								key={`cal-${key}`}
								month={month}
								year={year}
								workouts={entries}
								splits={splits}
								selectedDate={selectedDate}
								onDayPress={(date) => setSelectedDate(date)}
								useParentInset
							/>
						))}
					</VStack>
				</ScrollView>
			</Pressable>

			{/* Bottom action */}
			{selectedDate && ctaKind !== 'hidden' && (
				<Box position="absolute" left={0} right={0} bottom={0} bg="#1E2028" px="$4" pb="$8" pt="$3" borderTopWidth={1} borderColor="#2A2E38">
					<Pressable
						accessibilityRole="button"
						onPress={handleCtaPress}
						bg="#6B8EF2"
						borderRadius="$lg"
						py="$3"
						$pressed={{ opacity: 0.8 }}
					>
						<Text color="$white" fontWeight="$bold" textAlign="center">{ctaLabel}</Text>
					</Pressable>
				</Box>
			)}
		</Box>
	);
};

export default CalendarScreen;

