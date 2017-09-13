/**
 * External dependencies
 */
import debugFactory from 'debug';
import page from 'page';
import qs from 'querystring';
import ReactClass from 'react/lib/ReactClass';
import i18n, { setLocale } from 'i18n-calypso';
import { some, startsWith } from 'lodash';
import url from 'url';

/**
 * Internal dependencies
 */
import accessibleFocus from 'lib/accessible-focus';
import { bindState as bindWpLocaleState } from 'lib/wp/localization';
import config from 'config';
import { setRoute as setRouteAction } from 'state/ui/actions';
import switchLocale from 'lib/i18n-utils/switch-locale';
import touchDetect from 'lib/touch-detect';
import { subscribeToUserChanges } from './user';
import { getCurrentUser } from 'state/current-user/selectors';

const debug = debugFactory( 'calypso' );

const switchUserLocale = currentUser => {
	const localeSlug = currentUser.localeSlug;
	if ( localeSlug ) {
		switchLocale( localeSlug );
	}
};

const setupContextMiddleware = reduxStore => {
	page( '*', ( context, next ) => {
		const parsed = url.parse( location.href, true );

		// Decode the pathname by default (now disabled in page.js)
		context.pathname = decodeURIComponent( context.pathname );

		context.store = reduxStore;

		// Break routing and do full load for logout link in /me
		if ( context.pathname === '/wp-login.php' ) {
			window.location.href = context.path;
			return;
		}

		// set `context.query`
		const querystringStart = context.canonicalPath.indexOf( '?' );

		if ( querystringStart !== -1 ) {
			context.query = qs.parse( context.canonicalPath.substring( querystringStart + 1 ) );
		} else {
			context.query = {};
		}

		context.prevPath = parsed.path === context.path ? false : parsed.path;

		// set `context.hash` (we have to parse manually)
		if ( parsed.hash && parsed.hash.length > 1 ) {
			try {
				context.hash = qs.parse( parsed.hash.substring( 1 ) );
			} catch ( e ) {
				debug( 'failed to query-string parse `location.hash`', e );
				context.hash = {};
			}
		} else {
			context.hash = {};
		}
		next();
	} );
};

// We need to require sections to load React with i18n mixin
const loadSectionsMiddleware = () => require( 'sections' ).load();

const loggedOutMiddleware = reduxStore => {
	if ( getCurrentUser( reduxStore.getState() ) ) {
		return;
	}

	if ( config.isEnabled( 'desktop' ) ) {
		page( '/', () => {
			if ( config.isEnabled( 'oauth' ) ) {
				page.redirect( '/authorize' );
			} else {
				page.redirect( '/log-in' );
			}
		} );
	} else if ( config.isEnabled( 'devdocs/redirect-loggedout-homepage' ) ) {
		page( '/', () => {
			page.redirect( '/devdocs/start' );
		} );
	}

	const sections = require( 'sections' );
	const validSections = sections.get().reduce( ( acc, section ) => {
		return section.enableLoggedOut ? acc.concat( section.paths ) : acc;
	}, [] );
	const isValidSection = sectionPath => some(
		validSections, validPath => startsWith( sectionPath, validPath )
	);

	page( '*', ( context, next ) => {
		if ( isValidSection( context.path ) ) {
			next();
		}
	} );
};

const oauthTokenMiddleware = () => {
	if ( config.isEnabled( 'oauth' ) ) {
		// Forces OAuth users to the /login page if no token is present
		page( '*', require( 'auth/controller' ).checkToken );
	}
};

const setRouteMiddleware = () => {
	page( '*', ( context, next ) => {
		context.store.dispatch( setRouteAction(
			context.pathname,
			context.query
		) );

		next();
	} );
};

const clearNoticesMiddleware = () => {
	//TODO: remove this one when notices are reduxified - it is for old notices
	page( '*', require( 'notices' ).clearNoticesOnNavigation );
};

const unsavedFormsMiddleware = () => {
	// warn against navigating from changed, unsaved forms
	page.exit( '*', require( 'lib/protect-form' ).checkFormHandler );
};

export const locales = ( reduxStore ) => {
	debug( 'Executing Calypso locales.' );

	// Initialize i18n mixin
	ReactClass.injection.injectMixin( i18n.mixin );

	if ( window.i18nLocaleStrings ) {
		const i18nLocaleStringsObject = JSON.parse( window.i18nLocaleStrings );
		setLocale( i18nLocaleStringsObject );
	}

	const currentUser = getCurrentUser( reduxStore.getState() );

	// When the user is not bootstrapped, we also bootstrap the
	// locale strings
	if ( currentUser ) {
		switchUserLocale( currentUser );
	}

	subscribeToUserChanges( reduxStore, switchUserLocale );
};

export const utils = () => {
	debug( 'Executing Calypso utils.' );

	if ( process.env.NODE_ENV === 'development' ) {
		require( './dev-modules' )();
	}

	// Infer touch screen by checking if device supports touch events
	// See touch-detect/README.md
	if ( touchDetect.hasTouch() ) {
		document.documentElement.classList.add( 'touch' );
	} else {
		document.documentElement.classList.add( 'notouch' );
	}

	// Add accessible-focus listener
	accessibleFocus();
};

export const configureReduxStore = ( reduxStore ) => {
	debug( 'Executing Calypso configure Redux store.' );

	bindWpLocaleState( reduxStore );

	if ( config.isEnabled( 'network-connection' ) ) {
		asyncRequire( 'lib/network-connection', networkConnection => networkConnection.init( reduxStore ) );
	}
};

export const setupMiddlewares = ( reduxStore ) => {
	debug( 'Executing Calypso setup middlewares.' );

	setupContextMiddleware( reduxStore );
	oauthTokenMiddleware();
	loadSectionsMiddleware();
	loggedOutMiddleware( reduxStore );
	setRouteMiddleware();
	clearNoticesMiddleware();
	unsavedFormsMiddleware();
};
