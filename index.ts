import 'react-native-get-random-values';
import { LogBox } from 'react-native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { registerRootComponent } from 'expo';

import App from './App';

// Configure Reanimated logger to suppress warnings and below
try {
	configureReanimatedLogger({ level: ReanimatedLogLevel.error });
} catch {}

// Last-resort filter in case any remaining console.warn slips through
const __originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
	const msg = typeof args[0] === 'string' ? args[0] : '';
	if (
		msg.includes('Tried to modify key `current` of an object which has been already passed to a worklet') ||
		msg.includes('[Reanimated] Tried to modify key `current` of an object which has been already passed to a worklet')
	) {
		return; // swallow this noisy warning only
	}
	__originalConsoleWarn(...args);
};

// Silence specific noisy Reanimated warning globally as early as possible
LogBox.ignoreLogs([
	'Tried to modify key `current` of an object which has been already passed to a worklet',
	'[Reanimated] Tried to modify key `current` of an object which has been already passed to a worklet',
]);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
