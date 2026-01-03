# Frontend Troubleshooting Guide

## Common Issues

### Missing Native Binary Errors (Cross-Platform)

**Symptoms:**
```
Error: Cannot find module '@rollup/rollup-linux-x64-gnu'
Error: Cannot find module '@rollup/rollup-darwin-arm64'
Error: Cannot find module 'tinyrainbow'
Error: Cannot find module 'tinyexec'
```

**Root Cause:**
This is a known npm bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) that affects teams using both Linux and macOS. When package-lock.json is generated on one platform, npm may fail to install platform-specific optional dependencies for other platforms.

**Quick Fix:**
```bash
# From the repository root directory:
cd /home/patrick/hilo
rm -rf node_modules package-lock.json
npm install

# Verify tests run:
cd frontend
npm run test
```

**Why This Happens:**
- npm v10.3.0+ prunes platform-specific optional dependencies from package-lock.json
- Developers on macOS generate lockfiles missing Linux binaries (and vice versa)
- npm silently skips installing missing platform-specific dependencies
- Packages like Rollup and Vitest depend on native binaries that vary by platform

**Prevention:**
- When switching between Linux and macOS development, regenerate node_modules if you encounter errors
- Consider using `pnpm` or `yarn` which handle cross-platform dependencies better
- Never copy node_modules between different operating systems or architectures

---

## Running Tests

### Unit/Integration Tests
```bash
npm run test          # Run all tests once
npm run test:watch    # Run tests in watch mode
```

### UI Tests (Interactive)
```bash
npm run test:ui       # Launch Vitest UI in browser
```

The Vitest UI provides:
- Interactive test explorer
- Visual test results and coverage
- Real-time test watching
- Detailed error inspection

**Access:** Opens automatically in your browser at `http://localhost:51204` (or similar)

---

## Development Workflow Issues

### Tests Fail After Pulling Changes

**Solution:**
```bash
# From root directory
npm install --include=dev --include=optional

# If that doesn't work, do a clean install
rm -rf node_modules package-lock.json
npm install
```

### Vitest Dependencies Missing

If you see errors about missing vitest dependencies:
```bash
# From frontend directory
npm uninstall vitest
npm install --save-dev vitest@4.0.16
```

---

## Getting Help

1. Check this troubleshooting guide first
2. Try the "Quick Fix" for dependency issues
3. Verify your Node.js version: `node --version` (should be v22.x)
4. Check git status to see if package.json was modified unexpectedly
5. Ask the team - others may have encountered the issue on their platform

---

## Additional Resources

- [npm optional dependencies bug](https://github.com/npm/cli/issues/4828)
- [Vitest documentation](https://vitest.dev)
- [Rollup cross-platform issues](https://github.com/vitejs/vite/discussions/15532)
