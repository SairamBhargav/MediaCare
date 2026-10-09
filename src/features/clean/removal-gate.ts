/**
 * Removal stays off in release builds (TestFlight) until it has been proven
 * on purpose-made test photos with the owner's go-ahead
 * (docs/PRIVACY_AND_SAFETY.md, ROADMAP release boundaries). Development
 * builds keep the Settings switch so that test can happen.
 */
export const REMOVAL_IN_THIS_BUILD = __DEV__;
