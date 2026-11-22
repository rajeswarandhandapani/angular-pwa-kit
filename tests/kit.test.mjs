import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  addDays, createDateFormatters, daysBetween, fromIso, mondayOf, nextMonday, toIso, weekDates, weekdayOf,
} from '../kit/dates.ts';
import { makeCalendar, reminderDue } from '../kit/ics.ts';
import { barPath, niceScale } from '../kit/chart-kit.ts';

const require = createRequire(import.meta.url);
const { inspectApp, syncNgKit } = require('../bin/sync-ng-kit.cjs');
const { wireAngularPwa } = require('../bin/new-ng-pwa.cjs');

describe('kit/dates.ts', () => {
  it('handles DST transitions safely using local noon', () => {
    const d = fromIso('2026-11-01'); // US DST fallback Sunday
    assert.equal(d.getHours(), 12);
    assert.equal(addDays('2026-11-01', 1), '2026-11-02');
    assert.equal(addDays('2026-03-08', -1), '2026-03-07');
    assert.equal(daysBetween('2026-11-01', '2026-11-08'), 7);
    assert.equal(weekdayOf('2026-11-16'), 1); // Monday
    assert.equal(mondayOf('2026-11-19'), '2026-11-16');
    assert.equal(nextMonday('2026-11-16'), '2026-11-16');
    assert.equal(nextMonday('2026-11-18'), '2026-11-23');
    assert.equal(weekDates('2026-11-16').length, 7);
    assert.equal(toIso(fromIso('2026-02-28')), '2026-02-28');
    const fmt = createDateFormatters('en-US');
    assert.match(fmt.longDate('2026-11-16'), /Nov.*16/);
  });
});

describe('kit/ics.ts', () => {
  it('evaluates reminder schedule and generates valid RFC 5545 calendar', () => {
    const rem = { enabled: true, time: '18:30', days: [1, 3, 5] };
    assert.equal(reminderDue({ reminder: rem, date: '2026-11-16', nowTime: '18:29', isDone: false }), false);
    assert.equal(reminderDue({ reminder: rem, date: '2026-11-16', nowTime: '18:30', isDone: false }), true);
    assert.equal(reminderDue({ reminder: rem, date: '2026-11-16', nowTime: '19:00', isDone: true }), false);
    assert.equal(reminderDue({ reminder: rem, date: '2026-11-16', nowTime: '19:00', lastSent: '2026-11-16' }), false);
    assert.equal(reminderDue({ reminder: rem, date: '2026-11-17', nowTime: '19:00', isDone: false }), false);

    const ics = makeCalendar({
      prodId: '-//Test App//EN',
      uidPrefix: 'test-app',
      startDate: '2026-11-16',
      today: '2026-11-16',
      time: '18:30',
      durationMin: 25,
      days: [1],
      weeks: 12,
      eventFor: iso => ({ title: `Practice ${iso}`, body: 'Focus time' }),
    });
    assert.match(ics, /^BEGIN:VCALENDAR/);
    assert.match(ics, /DTSTART:20261116T183000/);
    assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=12/);
    assert.match(ics, /SUMMARY:Practice 2026-11-16/);
    assert.match(ics, /END:VCALENDAR$/);
  });
});

describe('kit/chart-kit.ts', () => {
  it('builds SVG bar paths and readable axis scales', () => {
    const d = barPath(10, 180, 60, 20, 4);
    assert.match(d, /^M10,180V/);
    assert.match(d, /V180Z$/);
    const scale = niceScale(160);
    assert.ok(scale.top >= 160);
    assert.ok(scale.step > 0);
  });
});

describe('sync-ng-kit & new-ng-pwa CLI', () => {
  it('wires, verifies, detects drift, and repairs vendored kit files', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-pwa-kit-test-'));
    try {
      const appDir = path.join(tmp, 'sample-ng-app');
      wireAngularPwa([appDir, '--name', 'Sample Angular App', '--port', '4199']);

      assert.ok(fs.existsSync(path.join(appDir, 'angular-pwa-kit.json')));
      assert.ok(fs.existsSync(path.join(appDir, '.postcssrc.json')));
      assert.ok(fs.existsSync(path.join(appDir, '.github', 'workflows', 'deploy.yml')));
      assert.ok(fs.existsSync(path.join(appDir, 'src', 'app', 'kit', 'theme.css')));
      assert.ok(fs.existsSync(path.join(appDir, 'src', 'app', 'kit', 'timer.service.ts')));
      assert.equal(inspectApp(appDir).drift.length, 0);

      // Check mode passes cleanly
      assert.equal(syncNgKit(['--app', appDir, '--check']).driftedApps, 0);

      // Introduce drift in one vendored file
      const drifted = path.join(appDir, 'src', 'app', 'kit', 'dates.ts');
      fs.writeFileSync(drifted, '// local edit\n');
      assert.equal(inspectApp(appDir).drift.length, 1);
      assert.throws(() => syncNgKit(['--app', appDir, '--check']), /outdated vendored Angular kit/);

      // Repair drift cleanly
      assert.equal(syncNgKit(['--app', appDir]).driftedApps, 1);
      assert.equal(inspectApp(appDir).drift.length, 0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
