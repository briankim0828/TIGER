import 'react-native-get-random-values';
import { LogBox } from 'react-native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { registerRootComponent } from 'expo';

import App from './App';

// Configure Reanimated logger to suppress warnings and below
try {
	configureReanimatedLogger({ level: ReanimatedLogLevel.error });
} catch {}

// Last-resort filters for noisy warnings
const __originalConsoleWarn = console.warn;
const __originalConsoleError = console.error;
const shouldSuppress = (msg: string): boolean => {
	return (
		msg.includes('Text strings must be rendered within a <Text> component.') ||
		msg.includes('Tried to modify key `current` of an object which has been already passed to a worklet') ||
		msg.includes('[Reanimated] Tried to modify key `current` of an object which has been already passed to a worklet') ||
		msg.includes('SafeAreaView has been deprecated')
	);
};
console.warn = (...args: any[]) => {
	const msg = typeof args[0] === 'string' ? args[0] : '';
	if (shouldSuppress(msg)) return;
	__originalConsoleWarn(...args);
};
console.error = (...args: any[]) => {
	const msg = typeof args[0] === 'string' ? args[0] : '';
	if (shouldSuppress(msg)) return;
	__originalConsoleError(...args);
};

// Silence specific noisy Reanimated warning globally as early as possible
LogBox.ignoreLogs([
	'Tried to modify key `current` of an object which has been already passed to a worklet',
	'[Reanimated] Tried to modify key `current` of an object which has been already passed to a worklet',
    'Text strings must be rendered within a <Text> component.',
	'SafeAreaView has been deprecated',
]);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
