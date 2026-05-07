# Moodle 5.2 Developer API Reference
## Comprehensive Guide for Course Creator / .mbz Backup File Generator

*Compiled from moodledev.io/docs/5.2 — May 2026*

---

## TABLE OF CONTENTS

1. [.mbz Backup File Format — Architecture Overview](#1-mbz-backup-file-format--architecture-overview)
2. [Backup API](#2-backup-api)
3. [Restore API](#3-restore-api)
4. [Activity Module Plugin Structure (mod)](#4-activity-module-plugin-structure-mod)
5. [File API](#5-file-api)
6. [Question & Quiz APIs](#6-question--quiz-apis)
7. [Gradebook & Grading APIs](#7-gradebook--grading-apis)
8. [Availability & Conditional Activities](#8-availability--conditional-activities)
9. [Activity Completion API](#9-activity-completion-api)
10. [Groups API](#10-groups-api)
11. [Enrolment API](#11-enrolment-api)
12. [Calendar API](#12-calendar-api)
13. [Tag API](#13-tag-api)
14. [Access (Capabilities) API](#14-access-capabilities-api)
15. [Data Manipulation API (DML)](#15-data-manipulation-api-dml)
16. [Data Definition API (DDL / XMLDB)](#16-data-definition-api-ddl--xmldb)
17. [Custom Fields API](#17-custom-fields-api)
18. [Privacy API](#18-privacy-api)
19. [Navigation API](#19-navigation-api)
20. [Output API & Mustache Templates](#20-output-api--mustache-templates)
21. [Forms API](#21-forms-api)
22. [Task API](#22-task-api)
23. [Cache API (MUC)](#23-cache-api-muc)
24. [Hooks API (PSR-14)](#24-hooks-api-psr-14)
25. [Dependency Injection API](#25-dependency-injection-api)
26. [External / Web Services API](#26-external--web-services-api)
27. [Message API](#27-message-api)
28. [Communication API (BigBlueButton / Matrix)](#28-communication-api-bigbluebutton--matrix)
29. [Analytics API](#29-analytics-api)
30. [Plugin Types Reference](#30-plugin-types-reference)
31. [Common Plugin Files Reference](#31-common-plugin-files-reference)
32. [Course Format Plugins](#32-course-format-plugins)
33. [Block Plugins](#33-block-plugins)
34. [Availability Condition Plugins](#34-availability-condition-plugins)
35. [Miscellaneous APIs](#35-miscellaneous-apis)
36. [Moodle 5.2 Specific Changes](#36-moodle-52-specific-changes)

---

## 1. .mbz BACKUP FILE FORMAT — ARCHITECTURE OVERVIEW

A `.mbz` file is a **gzip-compressed tar archive** (renamed .mbz from .tar.gz). When extracted it produces a directory tree:

```
moodle_backup/
├── moodle_backup.xml          ← Top-level manifest: lists all included items
├── course/
│   └── course.xml             ← Course record (fullname, shortname, summary, format, etc.)
├── sections/
│   └── section_NNNN/
│       └── section.xml        ← Section data (name, summary, sequence)
├── activities/
│   └── {modname}_{cmid}/
│       ├── {modname}.xml      ← Activity instance data
│       ├── grades.xml         ← Grade items for this activity
│       ├── calendar.xml       ← Calendar events
│       └── inforef.xml        ← References to files/questions used
├── files/
│   └── {contenthash}          ← Actual binary file content (SHA-1 named)
└── questions/
    └── categories/
        └── {category}/
            └── questions.xml  ← Question bank data
```

### moodle_backup.xml (Top-Level Manifest)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<moodle_backup>
  <information>
    <name>backup_courseshortname_20240101-1200.mbz</name>
    <moodle_version>2024042200</moodle_version>
    <moodle_release>5.2 (Build: 20240422)</moodle_release>
    <backup_version>2024042200</backup_version>
    <backup_release>5.2</backup_release>
    <backup_date>1704067200</backup_date>
    <mnet_remoteusers>0</mnet_remoteusers>
    <include_files>1</include_files>
    <include_file_references_to_external_content>0</include_file_references_to_external_content>
    <original_wwwroot>https://moodle.example.com</original_wwwroot>
    <original_site_identifier_hash>abc123...</original_site_identifier_hash>
    <original_course_id>42</original_course_id>
    <original_course_format>topics</original_course_format>
    <original_course_fullname>My Course</original_course_fullname>
    <original_course_shortname>MC101</original_course_shortname>
    <original_course_startdate>1696118400</original_course_startdate>
    <original_course_enddate>0</original_course_enddate>
    <original_course_contextid>123</original_course_contextid>
    <original_system_contextid>1</original_system_contextid>
    <contents>
      <course>
        <courseid>42</courseid>
        <title>My Course</title>
        <directory>course</directory>
      </course>
      <sections>
        <section>
          <sectionid>1</sectionid>
          <title>Week 1</title>
          <directory>sections/section_1</directory>
        </section>
      </sections>
      <activities>
        <activity>
          <moduleid>101</moduleid>
          <sectionid>1</sectionid>
          <modulename>page</modulename>
          <title>My Page</title>
          <directory>activities/page_101</directory>
        </activity>
        <activity>
          <moduleid>102</moduleid>
          <sectionid>1</sectionid>
          <modulename>label</modulename>
          <title>My Label</title>
          <directory>activities/label_102</directory>
        </activity>
      </activities>
      <blocks>
        <block>
          <blockid>5</blockid>
          <blockname>html</blockname>
          <directory>blocks/html_5</directory>
        </block>
      </blocks>
    </contents>
    <settings>
      <setting>
        <level>root</level>
        <name>filename</name>
        <value>backup_courseshortname_20240101-1200.mbz</value>
      </setting>
      <setting>
        <level>root</level>
        <name>imscc11</name>
        <value>0</value>
      </setting>
      <setting>
        <level>root</level>
        <name>users</name>
        <value>0</value>
      </setting>
      <setting>
        <level>root</level>
        <name>anonymize</name>
        <value>0</value>
      </setting>
      <setting>
        <level>root</level>
        <name>role_assignments</name>
        <value>0</value>
      </setting>
      <setting>
        <level>root</level>
        <name>activities</name>
        <value>1</value>
      </setting>
      <setting>
        <level>root</level>
        <name>blocks</name>
        <value>1</value>
      </setting>
      <setting>
        <level>root</level>
        <name>filters</name>
        <value>1</value>
      </setting>
      <setting>
        <level>root</level>
        <name>comments</name>
        <value>0</value>
      </setting>
      <setting>
        <level>root</level>
        <name>badges</name>
        <value>0</value>
      </setting>
      <setting>
        <level>root</level>
        <name>calendarevents</name>
        <value>1</value>
      </setting>
      <setting>
        <level>root</level>
        <name>userscompletion</name>
        <value>0</value>
      </setting>
      <setting>
        <level>root</level>
        <name>logs</name>
        <value>0</value>
      </setting>
      <setting>
        <level>root</level>
        <name>grade_histories</name>
        <value>0</value>
      </setting>
      <setting>
        <level>activity</level>
        <activity>page_101</activity>
        <name>page_101_included</name>
        <value>1</value>
      </setting>
      <setting>
        <level>activity</level>
        <activity>page_101</activity>
        <name>page_101_userinfo</name>
        <value>0</value>
      </setting>
    </settings>
  </information>
</moodle_backup>
```

### course/course.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<course id="42">
  <shortname>MC101</shortname>
  <fullname>My Course</fullname>
  <idnumber></idnumber>
  <summary>&lt;p&gt;Course description here&lt;/p&gt;</summary>
  <summaryformat>1</summaryformat>  <!-- 1=HTML, 0=MOODLE, 2=PLAIN, 4=MARKDOWN -->
  <format>topics</format>           <!-- topics, weeks, social, singleactivity, etc. -->
  <showgrades>1</showgrades>
  <newsitems>5</newsitems>
  <startdate>1696118400</startdate>
  <enddate>0</enddate>
  <marker>0</marker>
  <maxbytes>0</maxbytes>
  <legacyfiles>0</legacyfiles>
  <showreports>0</showreports>
  <visible>1</visible>
  <groupmode>0</groupmode>
  <groupmodeforce>0</groupmodeforce>
  <defaultgroupingid>0</defaultgroupingid>
  <lang></lang>
  <theme></theme>
  <timecreated>1696118400</timecreated>
  <timemodified>1696118400</timemodified>
  <requested>0</requested>
  <showactivitydates>1</showactivitydates>
  <showcompletionconditions>1</showcompletionconditions>
  <hiddensections>0</hiddensections>
  <coursedisplay>0</coursedisplay>
  <category>
    <name>Miscellaneous</name>
    <description></description>
  </category>
  <tags/>
  <customfields/>
  <courseformatoptions>
    <courseformatoption>
      <plugin_name>core_courseformat</plugin_name>
      <name>hiddensections</name>
      <value>0</value>
    </courseformatoption>
  </courseformatoptions>
  <enrolments>
    <enrols/>
  </enrolments>
</course>
```

### sections/section_N/section.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<section id="1">
  <number>1</number>
  <name>Week 1: Introduction</name>
  <summary>&lt;p&gt;Section summary text&lt;/p&gt;</summary>
  <summaryformat>1</summaryformat>
  <sequence>101,102,103</sequence>   <!-- comma-separated cmids in order -->
  <visible>1</visible>
  <availabilityjson></availabilityjson>  <!-- JSON availability conditions or empty -->
  <timemodified>1696118400</timemodified>
  <sectionformatoptions/>
</section>
```

**Section 0** always exists and holds course-level resources (before week 1):
```xml
<section id="0">
  <number>0</number>
  <name></name>  <!-- section 0 typically has no name -->
  <summary></summary>
  <summaryformat>1</summaryformat>
  <sequence></sequence>
  <visible>1</visible>
</section>
```

### activities/{modname}_{cmid}/{modname}.xml — Generic Course Module Wrapper

Every activity XML file wraps module-specific data inside a `<activity>` root with a `<module>` child for course_modules table fields:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<activity id="{instance_id}" moduleid="{cmid}" modulename="{modname}" contextid="{contextid}">
  <{modname} id="{instance_id}">
    <!-- module-specific fields here -->
  </{modname}>
</activity>
```

The surrounding `course_module` data (visible, groupmode, etc.) is stored in a separate file or merged. In practice the full activity XML includes:

```xml
<activity id="5" moduleid="101" modulename="page" contextid="456">
  <page id="5">
    <course>42</course>
    <name>My Page Resource</name>
    <intro>&lt;p&gt;Introduction text&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <content>&lt;p&gt;Main page content&lt;/p&gt;</content>
    <contentformat>1</contentformat>
    <legacyfiles>0</legacyfiles>
    <legacyfileslast>$@NULL@$</legacyfileslast>
    <display>5</display>
    <displayoptions>a:1:{s:10:"printintro";i:0;}</displayoptions>
    <revision>1</revision>
    <timemodified>1696118400</timemodified>
  </page>
</activity>
```

### activities/{modname}_{cmid}/inforef.xml

Tracks file and question references used by the activity:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<inforef>
  <fileref>
    <file>
      <id>123</id>
    </file>
  </fileref>
  <question_categoryref>
    <question_category>
      <id>5</id>
    </question_category>
  </question_categoryref>
</inforef>
```

### activities/{modname}_{cmid}/grades.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<activity_gradebook>
  <grade_items>
    <grade_item id="7">
      <categoryid>$@NULL@$</categoryid>
      <itemname>$@NULL@$</itemname>
      <itemtype>mod</itemtype>
      <itemmodule>quiz</itemmodule>
      <iteminstance>5</iteminstance>
      <itemnumber>0</itemnumber>
      <iteminfo>$@NULL@$</iteminfo>
      <idnumber></idnumber>
      <calculation>$@NULL@$</calculation>
      <gradetype>1</gradetype>
      <grademax>100.00000</grademax>
      <grademin>0.00000</grademin>
      <scaleid>$@NULL@$</scaleid>
      <outcomeid>$@NULL@$</outcomeid>
      <gradepass>0.00000</gradepass>
      <multfactor>1.00000</multfactor>
      <plusfactor>0.00000</plusfactor>
      <aggregationcoef>0.00000</aggregationcoef>
      <aggregationcoef2>0.00000</aggregationcoef2>
      <weightoverride>0</weightoverride>
      <sortorder>1</sortorder>
      <display>0</display>
      <decimals>$@NULL@$</decimals>
      <hidden>0</hidden>
      <locked>0</locked>
      <locktime>0</locktime>
      <needsupdate>0</needsupdate>
      <timecreated>1696118400</timecreated>
      <timemodified>1696118400</timemodified>
      <grade_grades/>
    </grade_item>
  </grade_items>
  <grade_letters/>
</activity_gradebook>
```

### activities/{modname}_{cmid}/calendar.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<events>
  <event id="3">
    <name>Quiz closes</name>
    <description></description>
    <descriptionformat>1</descriptionformat>
    <timestart>1698710400</timestart>
    <timeduration>0</timeduration>
    <eventtype>close</eventtype>  <!-- open, close, gradingdue, etc. -->
    <courseid>42</courseid>
    <groupid>0</groupid>
    <userid>0</userid>
    <modulename>quiz</modulename>
    <instance>5</instance>
    <sequence>1</sequence>
    <timemodified>1696118400</timemodified>
    <repeatid>0</repeatid>
    <type>1</type>
    <format>1</format>
    <visible>1</visible>
  </event>
</events>
```

### files/ directory

Binary file content is stored as flat files named by their **SHA-1 content hash**. The `files.xml` in the backup root (or inforef.xml) references them:

```xml
<!-- Typical file record in a files.xml -->
<file id="123">
  <contenthash>da39a3ee5e6b4b0d3255bfef95601890afd80709</contenthash>
  <contextid>456</contextid>
  <component>mod_page</component>
  <filearea>content</filearea>
  <itemid>0</itemid>
  <filepath>/</filepath>
  <filename>document.pdf</filename>
  <userid>2</userid>
  <filesize>102400</filesize>
  <mimetype>application/pdf</mimetype>
  <status>0</status>
  <timecreated>1696118400</timecreated>
  <timemodified>1696118400</timemodified>
  <source>document.pdf</source>
  <author>Admin User</author>
  <license>allrightsreserved</license>
  <sortorder>0</sortorder>
  <repositorytype>$@NULL@$</repositorytype>
  <repositoryid>$@NULL@$</repositoryid>
  <reference>$@NULL@$</reference>
</file>
```

**Special sentinel value:** `$@NULL@$` represents a SQL NULL in the XML.

---

## 2. BACKUP API

**Location:** `backup/` in Moodle root  
**Reference:** `moodledev.io/docs/5.2/apis/subsystems/backup`

### Architecture

```
Backup Plan
  └── Backup Tasks (one per plugin/subsystem)
        └── Backup Steps (one or more per task)
              └── backup_nested_element trees → written to XML
```

### Activity Module Backup Files

Location: `mod/{modname}/backup/moodle2/`

| File | Purpose |
|------|---------|
| `backup_{modname}_activity_task.class.php` | Defines the backup task |
| `backup_{modname}_stepslib.php` | Defines structure step(s) |
| `backup_{modname}_settingslib.php` | Optional custom settings |

### backup_{modname}_activity_task (extends backup_activity_task)

**Three required methods:**

```php
class backup_page_activity_task extends backup_activity_task {

    // 1. Custom backup settings (usually empty for simple modules)
    protected function define_my_settings() {
        // e.g., $this->add_setting(new backup_activity_generic_setting(...));
    }

    // 2. Register the structure step(s)
    protected function define_my_steps() {
        $this->add_step(new backup_page_activity_structure_step(
            'page_structure', 'page.xml'
        ));
    }

    // 3. Encode internal URLs to portable form
    static public function encode_content_links($content) {
        global $CFG;
        $base = preg_quote($CFG->wwwroot, '/');
        // Replace absolute URLs with encoded tokens
        $search = '/(' . $base . '\/mod\/page\/view\.php\?id=)([0-9]+)/';
        $content = preg_replace($search, '$@PAGEVIEWBYID*$2@$', $content);
        return $content;
    }
}
```

### backup_{modname}_activity_structure_step (extends backup_activity_structure_step)

**Core method: define_structure()**

```php
class backup_page_activity_structure_step extends backup_activity_structure_step {

    protected function define_structure() {

        // 1. Build nested element tree
        //    backup_nested_element($name, $attributes, $elements)
        $page = new backup_nested_element('page', ['id'], [
            'course', 'name', 'intro', 'introformat',
            'content', 'contentformat', 'display',
            'displayoptions', 'revision', 'timemodified'
        ]);

        // For elements with children:
        // $forum = new backup_nested_element('forum', ['id'], [...fields...]);
        // $discussions = new backup_nested_element('discussions');
        // $discussion = new backup_nested_element('discussion', ['id'], [...]);
        // $forum->add_child($discussions);
        // $discussions->add_child($discussion);

        // 2. Set data source (table name, WHERE clause using activity id)
        $page->set_source_table('page', ['id' => backup::VAR_ACTIVITYID]);

        // For SQL source:
        // $discussion->set_source_sql(
        //     'SELECT * FROM {forum_discussions} WHERE forum = ?',
        //     [backup::VAR_PARENTID]   // parent element's id
        // );

        // 3. Annotate IDs that need remapping on restore
        // $page->annotate_ids('user', 'userid');  // if has user references
        // $page->annotate_files('mod_page', 'intro', null);  // files in intro
        // $page->annotate_files('mod_page', 'content', null);

        // 4. Return root wrapped in activity structure
        return $this->prepare_activity_structure($page);
    }
}
```

### backup_nested_element Constructor

```php
new backup_nested_element(
    $name,        // XML element name
    $attributes,  // array of attribute names (mapped from DB columns)
    $elements     // array of child element names (DB column names)
);
```

### Key backup:: Constants

| Constant | Value/Meaning |
|----------|---------------|
| `backup::VAR_ACTIVITYID` | Current activity instance ID |
| `backup::VAR_PARENTID` | Parent element's ID |
| `backup::VAR_COURSEID` | Course ID |
| `backup::VAR_SECTIONID` | Section ID |
| `backup::VAR_CONTEXTID` | Context ID |
| `backup::LOG_DEBUG` | Debug log level |
| `backup::LOG_INFO` | Info log level |
| `backup::LOG_WARNING` | Warning log level |

### Block Backup

Location: `blocks/{pluginname}/backup/moodle2/`  
Required: `backup_{pluginname}_block_task.class.php`

Extra methods for blocks:
- `get_fileareas()` — returns array of file area names in block context
- `get_configdata_encoded_attributes()` — config elements needing URL encoding

---

## 3. RESTORE API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/backup/restore`

### Architecture

```
Restore Plan
  └── Restore Tasks (one per plugin)
        └── Restore Steps (parse XML → insert to DB)
```

### Activity Module Restore Files

Location: `mod/{modname}/backup/moodle2/`

| File | Purpose |
|------|---------|
| `restore_{modname}_activity_task.class.php` | Main restore task |
| `restore_{modname}_stepslib.php` | XML parsing steps |

### restore_{modname}_activity_structure_step

```php
class restore_page_activity_structure_step extends restore_activity_structure_step {

    protected function define_structure() {
        $paths = [];

        // Register XML paths to listen for
        $paths[] = new restore_path_element('page', '/activity/page');

        // For nested elements:
        // $paths[] = new restore_path_element('discussion',
        //     '/activity/forum/discussions/discussion');

        return $this->prepare_activity_structure($paths);
    }

    // Called when a <page> element is fully parsed
    protected function process_page($data) {
        global $DB;
        $data = (object) $data;
        $oldid = $data->id;

        $data->course = $this->get_courseid();
        $data->timemodified = $this->apply_date_offset($data->timemodified);

        // Insert new record
        $newitemid = $DB->insert_record('page', $data);

        // Map old ID to new ID (critical for file/grade remapping)
        $this->set_mapping('page', $oldid, $newitemid, true);
        // true = has files associated (creates a file mapping context)
    }

    // After all XML parsed, restore files
    protected function after_execute() {
        $this->add_related_files('mod_page', 'intro', null);
        $this->add_related_files('mod_page', 'content', null);
    }
}
```

---

## 4. ACTIVITY MODULE PLUGIN STRUCTURE (mod)

**Reference:** `moodledev.io/docs/5.2/apis/plugintypes/mod`

### Required Files

```
mod/{modname}/
├── version.php              ← Plugin metadata
├── lib.php                  ← Bridge callbacks (add/update/delete instance)
├── mod_form.php             ← Creation/editing form
├── index.php                ← Activity listing (redirect to overview)
├── view.php                 ← Activity display page
├── lang/en/{modname}.php    ← Language strings
├── pix/icon.svg             ← Activity icon
├── db/
│   ├── install.xml          ← DB schema
│   ├── access.php           ← Capabilities
│   └── upgrade.php          ← Upgrade steps
└── backup/moodle2/          ← Backup/restore classes
```

### Required DB Table Structure

Every activity module's primary table (`mdl_{modname}`) must include:

| Field | Type | Notes |
|-------|------|-------|
| `id` | INT(10) BIGINT | Primary key, auto-increment |
| `course` | INT(10) BIGINT | FK to mdl_course.id |
| `name` | VARCHAR(255) | Activity name (shown in course) |
| `timemodified` | INT(10) BIGINT | Unix timestamp |
| `intro` | LONGTEXT | Activity description/introduction |
| `introformat` | SMALLINT | Format: 1=HTML, 0=MOODLE, 2=PLAIN, 4=MARKDOWN |

### lib.php Required Callbacks

```php
// Called when teacher creates activity instance
function {modname}_add_instance(stdClass $instancedata, ?moodleform $mform = null): int {
    global $DB;
    $instancedata->timemodified = time();
    return $DB->insert_record('{modname}', $instancedata);
}

// Called when teacher edits activity
function {modname}_update_instance(stdClass $instancedata, ?moodleform $mform): bool {
    global $DB;
    $instancedata->timemodified = time();
    $instancedata->id = $instancedata->instance;
    return $DB->update_record('{modname}', $instancedata);
}

// Called when activity is deleted
function {modname}_delete_instance(int $id): bool {
    global $DB;
    if (!$DB->get_record('{modname}', ['id' => $id])) {
        return false;
    }
    $DB->delete_records('{modname}', ['id' => $id]);
    return true;
}
```

### supports() Function — Feature Declarations

```php
function {modname}_supports(string $feature): bool|string|null {
    return match ($feature) {
        FEATURE_GROUPS                     => true,
        FEATURE_GROUPINGS                  => true,
        FEATURE_MOD_INTRO                  => true,  // shows description field
        FEATURE_COMPLETION_TRACKS_VIEWS    => true,  // completion on view
        FEATURE_GRADE_HAS_GRADE            => true,  // has gradebook entry
        FEATURE_BACKUP_MOODLE2             => true,  // REQUIRED for backup
        FEATURE_SHOW_DESCRIPTION           => true,
        FEATURE_NO_VIEW_LINK               => false, // true for label-like modules
        FEATURE_MOD_PURPOSE                => MOD_PURPOSE_CONTENT,
        default                            => null,
    };
}
```

### MOD_PURPOSE Constants

| Constant | Use Case |
|----------|----------|
| `MOD_PURPOSE_ADMINISTRATION` | Course management tools |
| `MOD_PURPOSE_ASSESSMENT` | Quizzes, assignments, etc. |
| `MOD_PURPOSE_COLLABORATION` | Forums, wikis, etc. |
| `MOD_PURPOSE_COMMUNICATION` | Chat, BBB, etc. |
| `MOD_PURPOSE_INTERACTIVECONTENT` | H5P, SCORM, etc. |
| `MOD_PURPOSE_CONTENT` | Page, Book, File, Label |
| `MOD_PURPOSE_OTHER` | Miscellaneous |

### Required Capabilities (db/access.php)

```php
$capabilities = [
    'mod/{modname}:addinstance' => [
        'riskbitmask'  => RISK_XSS,
        'captype'      => 'write',
        'contextlevel' => CONTEXT_COURSE,
        'archetypes'   => [
            'editingteacher' => CAP_ALLOW,
            'manager'        => CAP_ALLOW,
        ],
        'clonepermissionsfrom' => 'moodle/course:manageactivities',
    ],
    'mod/{modname}:view' => [
        'captype'      => 'read',
        'contextlevel' => CONTEXT_MODULE,
        'archetypes'   => [
            'guest'          => CAP_ALLOW,
            'student'        => CAP_ALLOW,
            'teacher'        => CAP_ALLOW,
            'editingteacher' => CAP_ALLOW,
            'manager'        => CAP_ALLOW,
        ],
    ],
];
```

### version.php

```php
$plugin->component  = 'mod_{modname}';
$plugin->version    = 2024042200;    // YYYYMMDDNN
$plugin->requires   = 2024041900;    // min Moodle version
$plugin->maturity   = MATURITY_STABLE;
$plugin->release    = '1.0';
$plugin->supported  = [402, 500];    // [min_branch, max_branch]
// $plugin->dependencies = ['mod_forum' => 2024041900];
```

### Module-Specific Activity XML Examples

#### Label (mod_label)

```xml
<activity id="3" moduleid="103" modulename="label" contextid="789">
  <label id="3">
    <course>42</course>
    <name>My Label</name>
    <intro>&lt;p&gt;Label content displayed directly in course&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <timemodified>1696118400</timemodified>
  </label>
</activity>
```

Label's `supports()` returns `FEATURE_NO_VIEW_LINK => true` (no view.php link shown).

#### Page (mod_page)

```xml
<activity id="5" moduleid="105" modulename="page" contextid="790">
  <page id="5">
    <course>42</course>
    <name>Introduction to Topic</name>
    <intro>&lt;p&gt;Brief description&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <content>&lt;p&gt;Full page content with HTML&lt;/p&gt;</content>
    <contentformat>1</contentformat>
    <legacyfiles>0</legacyfiles>
    <legacyfileslast>$@NULL@$</legacyfileslast>
    <display>5</display>
    <!-- display: 0=auto, 1=embed, 3=new window, 5=open (default), 6=in-frame -->
    <displayoptions>a:1:{s:10:"printintro";i:0;}</displayoptions>
    <revision>1</revision>
    <timemodified>1696118400</timemodified>
  </page>
</activity>
```

#### Forum (mod_forum)

```xml
<activity id="7" moduleid="107" modulename="forum" contextid="791">
  <forum id="7">
    <course>42</course>
    <type>general</type>
    <!-- type: general, single, news, blog, teacher, qanda, eachuser -->
    <name>General Discussion</name>
    <intro>&lt;p&gt;Forum description&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <assessed>0</assessed>
    <assesstimestart>0</assesstimestart>
    <assesstimefinish>0</assesstimefinish>
    <scale>0</scale>
    <maxbytes>512000</maxbytes>
    <maxattachments>9</maxattachments>
    <forcesubscribe>0</forcesubscribe>
    <!-- 0=optional, 1=forced, 2=auto, 3=disallowed -->
    <trackingtype>1</trackingtype>
    <rsstype>0</rsstype>
    <rssarticles>0</rssarticles>
    <timemodified>1696118400</timemodified>
    <warnafter>0</warnafter>
    <blockafter>0</blockafter>
    <blockperiod>0</blockperiod>
    <completiondiscussions>0</completiondiscussions>
    <completionreplies>0</completionreplies>
    <completionposts>0</completionposts>
    <displaywordcount>0</displaywordcount>
    <lockdiscussionafter>0</lockdiscussionafter>
    <duedate>0</duedate>
    <cutoffdate>0</cutoffdate>
    <discussions>
      <!-- discussions included only if userinfo=true in backup settings -->
    </discussions>
  </forum>
</activity>
```

#### Quiz (mod_quiz)

```xml
<activity id="9" moduleid="109" modulename="quiz" contextid="792">
  <quiz id="9">
    <course>42</course>
    <name>Module 1 Quiz</name>
    <intro>&lt;p&gt;Complete this quiz&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <timeopen>0</timeopen>
    <timeclose>0</timeclose>
    <timelimit>0</timelimit>
    <overduehandling>autosubmit</overduehandling>
    <graceperiod>0</graceperiod>
    <preferredbehaviour>deferredfeedback</preferredbehaviour>
    <canredoquestions>0</canredoquestions>
    <attempts>0</attempts>
    <!-- attempts: 0=unlimited -->
    <attemptonlast>0</attemptonlast>
    <grademethod>1</grademethod>
    <!-- grademethod: 1=highest, 2=average, 3=first, 4=last -->
    <decimalpoints>2</decimalpoints>
    <questiondecimalpoints>-1</questiondecimalpoints>
    <reviewattempt>69904</reviewattempt>
    <reviewcorrectness>4352</reviewcorrectness>
    <reviewmarks>4352</reviewmarks>
    <reviewspecificfeedback>4352</reviewspecificfeedback>
    <reviewgeneralfeedback>4352</reviewgeneralfeedback>
    <reviewrightanswer>4352</reviewrightanswer>
    <reviewoverallfeedback>4352</reviewoverallfeedback>
    <questionsperpage>1</questionsperpage>
    <navmethod>free</navmethod>
    <!-- navmethod: free or sequential -->
    <shuffleanswers>1</shuffleanswers>
    <sumgrades>10.00000</sumgrades>
    <grade>10.00000</grade>
    <timecreated>1696118400</timecreated>
    <timemodified>1696118400</timemodified>
    <password></password>
    <subnet></subnet>
    <browsersecurity>-</browsersecurity>
    <delay1>0</delay1>
    <delay2>0</delay2>
    <showuserpicture>0</showuserpicture>
    <showblocks>0</showblocks>
    <completionattemptsexhausted>$@NULL@$</completionattemptsexhausted>
    <completionminattempts>0</completionminattempts>
    <allowofflineattempts>0</allowofflineattempts>
    <question_instances>
      <question_instance id="1">
        <slot>1</slot>
        <page>1</page>
        <questionid>0</questionid>
        <!-- questionid=0 when using question_references (Moodle 4.0+) -->
        <maxmark>1.0000000</maxmark>
        <displaynumber>$@NULL@$</displaynumber>
        <question_reference>
          <version>$@NULL@$</version>
          <questionbankentryid>12</questionbankentryid>
        </question_reference>
      </question_instance>
    </question_instances>
    <sections>
      <section id="1">
        <firstslot>1</firstslot>
        <heading></heading>
        <shufflequestions>0</shufflequestions>
      </section>
    </sections>
    <feedbacks/>
    <overrides/>
  </quiz>
</activity>
```

#### Assignment (mod_assign)

```xml
<activity id="11" moduleid="111" modulename="assign" contextid="793">
  <assign id="11">
    <course>42</course>
    <name>Essay Assignment</name>
    <intro>&lt;p&gt;Write an essay&lt;/p&gt;</intro>
    <introformat>1</introformat>
    <alwaysshowdescription>1</alwaysshowdescription>
    <nosubmissions>0</nosubmissions>
    <submissiondrafts>0</submissiondrafts>
    <sendnotifications>0</sendnotifications>
    <sendlatenotifications>0</sendlatenotifications>
    <sendstudentnotifications>1</sendstudentnotifications>
    <duedate>0</duedate>
    <allowsubmissionsfromdate>0</allowsubmissionsfromdate>
    <grade>100</grade>
    <timemodified>1696118400</timemodified>
    <completionsubmit>0</completionsubmit>
    <cutoffdate>0</cutoffdate>
    <gradingduedate>0</gradingduedate>
    <teamsubmission>0</teamsubmission>
    <requireallteammemberssubmit>0</requireallteammemberssubmit>
    <teamsubmissiongroupingid>0</teamsubmissiongroupingid>
    <blindmarking>0</blindmarking>
    <hidegrader>0</hidegrader>
    <revealidentities>0</revealidentities>
    <attemptreopenmethod>none</attemptreopenmethod>
    <maxattempts>-1</maxattempts>
    <markingworkflow>0</markingworkflow>
    <markingallocation>0</markingallocation>
    <requiresubmissionstatement>0</requiresubmissionstatement>
    <preventsubmissionnotingroup>0</preventsubmissionnotingroup>
    <timelimit>0</timelimit>
    <submissionattachments>0</submissionattachments>
    <plugin_configs>
      <plugin_config>
        <plugin>assignsubmission_onlinetext</plugin>
        <subtype>assignsubmission</subtype>
        <name>enabled</name>
        <value>1</value>
      </plugin_config>
      <plugin_config>
        <plugin>assignsubmission_file</plugin>
        <subtype>assignsubmission</subtype>
        <name>enabled</name>
        <value>0</value>
      </plugin_config>
      <plugin_config>
        <plugin>assignfeedback_comments</plugin>
        <subtype>assignfeedback</subtype>
        <name>enabled</name>
        <value>1</value>
      </plugin_config>
    </plugin_configs>
    <submissions/>
  </assign>
</activity>
```

---

## 5. FILE API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/files`

### File Area Identifier (4 components)

```
contextid   → CONTEXT_MODULE contextid of the activity
component   → 'mod_page', 'mod_forum', 'block_html', etc.
filearea    → 'intro', 'content', 'attachment', 'post', etc.
itemid      → 0 for single-file areas, or record ID for multi-file areas
```

### Core Operations

```php
$fs = get_file_storage();

// File info record structure
$fileinfo = [
    'contextid' => $context->id,
    'component' => 'mod_mymodule',
    'filearea'  => 'content',
    'itemid'    => 0,
    'filepath'  => '/',
    'filename'  => 'myfile.pdf',
];

// Create from string
$fs->create_file_from_string($fileinfo, 'hello world');

// Create from disk
$fs->create_file_from_pathname($fileinfo, '/tmp/myfile.pdf');

// Create from URL
$fs->create_file_from_url($fileinfo, 'https://example.com/file.pdf');

// List files in area
$files = $fs->get_area_files($contextid, 'mod_myplugin', 'content', 0);

// Generate URL
$url = moodle_url::make_pluginfile_url(
    $file->get_contextid(),
    $file->get_component(),
    $file->get_filearea(),
    $file->get_itemid(),
    $file->get_filepath(),
    $file->get_filename()
);
```

### File Serving Callback (lib.php)

```php
function {modname}_pluginfile(
    $course, $cm, $context,
    string $filearea, array $args,
    bool $forcedownload, array $options
): bool {
    require_login($course, true, $cm);
    if ($filearea !== 'content') {
        return false;
    }
    $itemid = array_shift($args);
    $filename = array_pop($args);
    $filepath = $args ? '/' . implode('/', $args) . '/' : '/';
    $fs = get_file_storage();
    $file = $fs->get_file($context->id, 'mod_page', $filearea, $itemid, $filepath, $filename);
    if (!$file || $file->is_directory()) {
        return false;
    }
    send_stored_file($file, 86400, 0, $forcedownload, $options);
}
```

### File Format Codes

| Format Code | Name |
|-------------|------|
| 0 | FORMAT_MOODLE (legacy Moodle auto-format) |
| 1 | FORMAT_HTML |
| 2 | FORMAT_PLAIN |
| 4 | FORMAT_MARKDOWN |

---

## 6. QUESTION & QUIZ APIs

**Reference:** `moodledev.io/docs/5.2/apis/plugintypes/qtype`

### Question Bank XML Structure

Questions are stored in `questions/categories/{category}/questions.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<question_categories>
  <question_category id="5">
    <name>Default for My Course</name>
    <contextid>123</contextid>
    <contextlevel>50</contextlevel>
    <contextinstanceid>42</contextinstanceid>
    <info></info>
    <infoformat>0</infoformat>
    <stamp>moodle.example.com+1696118400+abc123</stamp>
    <parent>0</parent>
    <sortorder>999</sortorder>
    <idnumber>$@NULL@$</idnumber>
    <questions>
      <question id="12">
        <parent>0</parent>
        <name>Question 1</name>
        <questiontext>&lt;p&gt;What is 2+2?&lt;/p&gt;</questiontext>
        <questiontextformat>1</questiontextformat>
        <generalfeedback></generalfeedback>
        <generalfeedbackformat>1</generalfeedbackformat>
        <defaultmark>1.0000000</defaultmark>
        <penalty>0.3333333</penalty>
        <qtype>multichoice</qtype>
        <length>1</length>
        <stamp>moodle.example.com+1696118400+xyz456</stamp>
        <version>moodle.example.com+1696118400+ver001</version>
        <hidden>0</hidden>
        <idnumber></idnumber>
        <timecreated>1696118400</timecreated>
        <timemodified>1696118400</timemodified>
        <createdby>$@NULL@$</createdby>
        <modifiedby>$@NULL@$</modifiedby>
        <plugin_qtype_multichoice_question>
          <answers>
            <answer id="1">
              <answertext>4</answertext>
              <answertextformat>1</answertextformat>
              <fraction>1.0000000</fraction>
              <feedback>Correct!</feedback>
              <feedbackformat>1</feedbackformat>
            </answer>
            <answer id="2">
              <answertext>3</answertext>
              <answertextformat>1</answertextformat>
              <fraction>0.0000000</fraction>
              <feedback>Incorrect.</feedback>
              <feedbackformat>1</feedbackformat>
            </answer>
          </answers>
          <multichoice>
            <single>1</single>
            <shuffleanswers>1</shuffleanswers>
            <answernumbering>abc</answernumbering>
            <showstandardinstruction>1</showstandardinstruction>
            <correctfeedback>Your answer is correct.</correctfeedback>
            <correctfeedbackformat>1</correctfeedbackformat>
            <partiallycorrectfeedback>Your answer is partially correct.</partiallycorrectfeedback>
            <partiallycorrectfeedbackformat>1</partiallycorrectfeedbackformat>
            <incorrectfeedback>Your answer is incorrect.</incorrectfeedback>
            <incorrectfeedbackformat>1</incorrectfeedbackformat>
          </multichoice>
        </plugin_qtype_multichoice_question>
        <tags/>
        <question_bank_entry id="12">
          <idnumber>$@NULL@$</idnumber>
          <ownerid>$@NULL@$</ownerid>
        </question_bank_entry>
      </question>
    </questions>
  </question_category>
</question_categories>
```

### Common Question Types (qtype)

| qtype | Description |
|-------|-------------|
| `multichoice` | Multiple choice (single or multi-answer) |
| `truefalse` | True/false |
| `shortanswer` | Short answer (text match) |
| `numerical` | Numerical answer with tolerance |
| `essay` | Long-form essay (manual grading) |
| `match` | Matching questions |
| `ddwtos` | Drag and drop into text |
| `calculated` | Calculated with variables |
| `description` | Non-question description block |
| `random` | Random question from category |

### Question Bank Entry (Moodle 4.0+ structure)

Since Moodle 4.0, questions use a versioning system:
- `question_bank_entry` — unique entry in bank
- `question_versions` — version records per entry
- `question` — actual question content per version

---

## 7. GRADEBOOK & GRADING APIs

**Reference:** `moodledev.io/docs/5.2/apis/core/grading`

### Grade Item Types

| itemtype | Usage |
|----------|-------|
| `mod` | Activity grade item |
| `manual` | Manually created |
| `category` | Grade category total |
| `course` | Course total |

### Grade Types

| gradetype | Meaning |
|-----------|---------|
| 0 | GRADE_TYPE_NONE |
| 1 | GRADE_TYPE_VALUE (numerical) |
| 2 | GRADE_TYPE_SCALE |
| 3 | GRADE_TYPE_TEXT |

### grades.xml Full Structure

```xml
<activity_gradebook>
  <grade_items>
    <grade_item id="7">
      <categoryid>$@NULL@$</categoryid>
      <itemname>$@NULL@$</itemname>
      <itemtype>mod</itemtype>
      <itemmodule>quiz</itemmodule>
      <iteminstance>9</iteminstance>   <!-- quiz.id -->
      <itemnumber>0</itemnumber>
      <iteminfo>$@NULL@$</iteminfo>
      <idnumber></idnumber>
      <calculation>$@NULL@$</calculation>
      <gradetype>1</gradetype>
      <grademax>100.00000</grademax>
      <grademin>0.00000</grademin>
      <scaleid>$@NULL@$</scaleid>
      <outcomeid>$@NULL@$</outcomeid>
      <gradepass>0.00000</gradepass>
      <multfactor>1.00000</multfactor>
      <plusfactor>0.00000</plusfactor>
      <aggregationcoef>0.00000</aggregationcoef>
      <aggregationcoef2>0.00000</aggregationcoef2>
      <weightoverride>0</weightoverride>
      <sortorder>1</sortorder>
      <display>0</display>
      <decimals>$@NULL@$</decimals>
      <hidden>0</hidden>
      <locked>0</locked>
      <locktime>0</locktime>
      <needsupdate>0</needsupdate>
      <timecreated>1696118400</timecreated>
      <timemodified>1696118400</timemodified>
      <grade_grades/>
    </grade_item>
  </grade_items>
  <grade_letters/>
</activity_gradebook>
```

### Advanced Grading (Rubrics)

Modules declare support via `FEATURE_ADVANCED_GRADING => true` and implement `{modname}_grading_areas_list()`. Advanced grading definitions are stored in `grading_definitions` and backed up separately.

---

## 8. AVAILABILITY & CONDITIONAL ACTIVITIES

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/availability`

### JSON Format for Availability Conditions

Stored in `course_modules.availability` and `course_sections.availability`:

```json
{
  "op": "&",
  "c": [
    {
      "type": "date",
      "d": ">=",
      "t": 1696118400
    },
    {
      "type": "date",
      "d": "<",
      "t": 1698710400
    },
    {
      "type": "completion",
      "cm": 101,
      "e": 1
    },
    {
      "type": "grade",
      "id": 7,
      "min": 50.0
    },
    {
      "type": "group",
      "id": 3
    },
    {
      "type": "grouping",
      "id": 2
    },
    {
      "type": "profile",
      "sf": "email",
      "op": "contains",
      "v": "@example.com"
    }
  ],
  "show": true
}
```

### Operator Values

| op | Meaning |
|----|---------|
| `&` | AND — all conditions must be met |
| `\|` | OR — any condition must be met |
| `!&` | NOT AND — none of the conditions |
| `!\|` | NOT OR |

### Completion condition `e` values

| e | Meaning |
|---|---------|
| 0 | Activity is incomplete |
| 1 | Activity is complete |
| 2 | Activity is complete with passing grade |
| 3 | Activity is complete with failing grade |

### In XML (section.xml / activity course module data)

```xml
<availabilityjson>{"op":"&amp;","c":[{"type":"date","d":"&gt;=","t":1696118400}],"show":true}</availabilityjson>
```

Note: JSON is XML-encoded (& → &amp;, > → &gt;, < → &lt;).

---

## 9. ACTIVITY COMPLETION API

**Reference:** `moodledev.io/docs/5.2/apis/core/activitycompletion`

### Completion Types

| Type | Feature constant | Implementation |
|------|-----------------|----------------|
| On view | `FEATURE_COMPLETION_TRACKS_VIEWS` | Call `$completion->set_module_viewed($cm)` |
| On grade | `FEATURE_GRADE_HAS_GRADE` | Automatic when grade recorded |
| Custom rules | Manual implementation | `{modname}_get_completion_state()` |

### Completion XML in course_modules

```xml
<completiondata>
  <completion>2</completion>
  <!-- 0=disabled, 1=manual, 2=automatic -->
  <completionview>1</completionview>
  <completionusegrade>0</completionusegrade>
  <completionpassgrade>0</completionpassgrade>
  <completionexpected>0</completionexpected>
  <!-- specific module completion fields, e.g.: -->
  <completiondiscussions>2</completiondiscussions>
</completiondata>
```

---

## 10. GROUPS API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/group`

### Group Modes

| Constant | Value | Meaning |
|----------|-------|---------|
| `NOGROUPS` | 0 | Groups disabled |
| `SEPARATEGROUPS` | 1 | Users see only own group |
| `VISIBLEGROUPS` | 2 | All groups visible |

### Group Visibility

| Constant | Value | Meaning |
|----------|-------|---------|
| `GROUPS_VISIBILITY_ALL` | 0 | Everyone sees group |
| `GROUPS_VISIBILITY_MEMBERS` | 1 | Only members see it |
| `GROUPS_VISIBILITY_OWN` | 2 | Members see group, not individual membership |
| `GROUPS_VISIBILITY_NONE` | 3 | Hidden |

### Groups XML in course backup

```xml
<!-- In course.xml -->
<groups>
  <group id="3">
    <name>Group A</name>
    <idnumber></idnumber>
    <description></description>
    <descriptionformat>1</descriptionformat>
    <enrolmentkey></enrolmentkey>
    <picture>0</picture>
    <hidepicture>0</hidepicture>
    <timecreated>1696118400</timecreated>
    <timemodified>1696118400</timemodified>
    <visibility>0</visibility>
    <participation>1</participation>
  </group>
</groups>
<groupings>
  <grouping id="2">
    <name>Grouping 1</name>
    <idnumber></idnumber>
    <description></description>
    <descriptionformat>1</descriptionformat>
    <timecreated>1696118400</timecreated>
    <timemodified>1696118400</timemodified>
  </grouping>
</groupings>
```

---

## 11. ENROLMENT API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/enrol`

### Enrolment XML in course.xml

```xml
<enrolments>
  <enrols>
    <enrol id="1">
      <enrol>manual</enrol>
      <status>0</status>
      <!-- 0=enabled, 1=disabled -->
      <name>$@NULL@$</name>
      <enrolperiod>0</enrolperiod>
      <enrolstartdate>0</enrolstartdate>
      <enrolenddate>0</enrolenddate>
      <expirynotify>0</expirynotify>
      <expirythreshold>86400</expirythreshold>
      <notifyall>0</notifyall>
      <password>$@NULL@$</password>
      <cost>$@NULL@$</cost>
      <currency>$@NULL@$</currency>
      <roleid>5</roleid>
      <!-- roleid: 1=manager, 2=coursecreator, 3=editingteacher, 4=teacher, 5=student, 6=guest -->
      <customint1>$@NULL@$</customint1>
      <customint2>$@NULL@$</customint2>
      <customint3>$@NULL@$</customint3>
      <customint4>$@NULL@$</customint4>
      <customint5>$@NULL@$</customint5>
      <customint6>$@NULL@$</customint6>
      <customint7>$@NULL@$</customint7>
      <customint8>$@NULL@$</customint8>
      <customchar1>$@NULL@$</customchar1>
      <customchar2>$@NULL@$</customchar2>
      <customchar3>$@NULL@$</customchar3>
      <customdec1>$@NULL@$</customdec1>
      <customdec2>$@NULL@$</customdec2>
      <customtext1>$@NULL@$</customtext1>
      <customtext2>$@NULL@$</customtext2>
      <customtext3>$@NULL@$</customtext3>
      <customtext4>$@NULL@$</customtext4>
      <timecreated>1696118400</timecreated>
      <timemodified>1696118400</timemodified>
      <user_enrolments/>
    </enrol>
  </enrols>
</enrolments>
```

### Enrolment States

| Constant | Value |
|----------|-------|
| `ENROL_USER_ACTIVE` | 0 |
| `ENROL_USER_SUSPENDED` | 1 |

---

## 12. CALENDAR API

**Reference:** `moodledev.io/docs/5.2/apis/core/calendar`

### Event Types

| Constant | Value | Used for |
|----------|-------|----------|
| `CALENDAR_EVENT_TYPE_STANDARD` | 'standard' | Calendar-only events |
| `CALENDAR_EVENT_TYPE_ACTION` | 'action' | Dashboard action events |

### Event XML (calendar.xml in activity)

```xml
<event id="3">
  <name>Quiz opens</name>
  <description></description>
  <descriptionformat>1</descriptionformat>
  <timestart>1696118400</timestart>
  <timeduration>0</timeduration>
  <eventtype>open</eventtype>
  <!-- eventtype: open, close, gradingdue, due, expectcompletionon -->
  <courseid>42</courseid>
  <groupid>0</groupid>
  <userid>0</userid>
  <modulename>quiz</modulename>
  <instance>9</instance>
  <sequence>1</sequence>
  <timemodified>1696118400</timemodified>
  <repeatid>0</repeatid>
  <type>1</type>
  <format>1</format>
  <visible>1</visible>
</event>
```

---

## 13. TAG API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/tag`

### Key Classes

- `core_tag_tag` — main tag class (`tag/classes/tag.php`)
- `core_tag_collection` — tag collections
- `core_tag_area` — taggable areas

### Tag XML in backup

```xml
<tags>
  <tag>
    <id>5</id>
    <name>moodle</name>
    <rawname>Moodle</rawname>
  </tag>
</tags>
```

### db/tag.php Format

```php
$tagareas = [
    [
        'component'  => 'mod_mymodule',
        'itemtype'   => 'mymodule',
        'callback'   => 'mod_mymodule_get_tagged_items',
        'callbackfile' => '/mod/mymodule/lib.php',
    ],
];
```

---

## 14. ACCESS (CAPABILITIES) API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/access`

### Context Hierarchy

```
CONTEXT_SYSTEM (1)
  └── CONTEXT_COURSECAT (40)
        └── CONTEXT_COURSE (50)
              └── CONTEXT_MODULE (70)
              └── CONTEXT_BLOCK (80)
  └── CONTEXT_USER (30)
```

### Key Functions

```php
has_capability('mod/forum:post', $context, $userid);
require_capability('mod/quiz:attempt', $context);
require_login($course, true, $cm);
is_enrolled($context, $userid);
get_users_by_capability($context, 'mod/forum:post');
```

### Risk Bitmask Values

| Constant | Value | Meaning |
|----------|-------|---------|
| `RISK_SPAM` | 0x0001 | Can create spam |
| `RISK_PERSONAL` | 0x0002 | Access private data |
| `RISK_XSS` | 0x0004 | Can inject scripts |
| `RISK_CONFIG` | 0x0008 | Can change config |
| `RISK_MANAGETRUST` | 0x0010 | Can change trust |
| `RISK_DATALOSS` | 0x0020 | Can destroy data |

---

## 15. DATA MANIPULATION API (DML)

**Reference:** `moodledev.io/docs/5.2/apis/core/dml`

### Essential Functions

```php
global $DB;

// Single record
$record = $DB->get_record('tablename', ['field' => $value], '*', MUST_EXIST);
$record = $DB->get_record_sql("SELECT * FROM {tablename} WHERE id = ?", [$id]);

// Multiple records
$records = $DB->get_records('tablename', ['courseid' => $courseid]);
$records = $DB->get_records_sql("SELECT * FROM {tablename} WHERE ...", $params);

// Field value
$name = $DB->get_field('course', 'fullname', ['id' => $courseid]);

// Insert/Update/Delete
$id = $DB->insert_record('tablename', $dataobject);
$DB->update_record('tablename', $dataobject);  // $dataobject must have ->id
$DB->delete_records('tablename', ['id' => $id]);

// Count / Exists
$count = $DB->count_records('tablename', ['courseid' => $id]);
$exists = $DB->record_exists('tablename', ['field' => $value]);

// Large result sets (memory efficient)
$rs = $DB->get_recordset('tablename', ['courseid' => $id]);
foreach ($rs as $record) { /* process */ }
$rs->close();
```

**Table name convention:** Always use `{tablename}` with curly braces — Moodle adds the `mdl_` prefix automatically.

---

## 16. DATA DEFINITION API (DDL / XMLDB)

**Reference:** `moodledev.io/docs/5.2/apis/core/dml/ddl`

### db/install.xml Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<XMLDB PATH="mod/mymodule/db" VERSION="20240101" COMMENT="XMLDB file for mod_mymodule">
  <TABLES>
    <TABLE NAME="mymodule" COMMENT="Main table for mymodule">
      <FIELDS>
        <FIELD NAME="id" TYPE="int" LENGTH="10" NOTNULL="true" SEQUENCE="true" COMMENT="Primary key"/>
        <FIELD NAME="course" TYPE="int" LENGTH="10" NOTNULL="true" DEFAULT="0" COMMENT="Course id"/>
        <FIELD NAME="name" TYPE="char" LENGTH="255" NOTNULL="true" COMMENT="Name"/>
        <FIELD NAME="intro" TYPE="text" NOTNULL="false" COMMENT="Description"/>
        <FIELD NAME="introformat" TYPE="int" LENGTH="4" NOTNULL="true" DEFAULT="0" COMMENT="Format"/>
        <FIELD NAME="timemodified" TYPE="int" LENGTH="10" NOTNULL="true" DEFAULT="0" COMMENT="Modified time"/>
        <FIELD NAME="grade" TYPE="int" LENGTH="10" NOTNULL="true" DEFAULT="100" COMMENT="Grade max"/>
      </FIELDS>
      <KEYS>
        <KEY NAME="primary" TYPE="primary" FIELDS="id"/>
        <KEY NAME="fk_course" TYPE="foreign" FIELDS="course" REFTABLE="course" REFFIELDS="id"/>
      </KEYS>
      <INDEXES>
        <INDEX NAME="course" UNIQUE="false" FIELDS="course"/>
      </INDEXES>
    </TABLE>
  </TABLES>
</XMLDB>
```

### FIELD TYPE Values

| TYPE | SQL Equivalent | Notes |
|------|---------------|-------|
| `int` | INTEGER/BIGINT | Use LENGTH to control size |
| `number` | DECIMAL/NUMERIC | Use DECIMALS for precision |
| `float` | FLOAT | Approximate |
| `char` | VARCHAR | Up to 1333 chars recommended |
| `text` | TEXT/CLOB | Unlimited text |
| `binary` | BLOB | Binary data |
| `datetime` | (deprecated) | Use int timestamp instead |

---

## 17. CUSTOM FIELDS API

**Reference:** `moodledev.io/docs/5.2/apis/core/customfields`

### Handler Class Pattern

```php
// Handler class: {pluginname}/customfield/{area}_handler
class course_handler extends \core_customfield\handler {
    public static function create(int $itemid = 0): handler {
        return new self($itemid);  // protected constructor
    }
    public function get_configuration_context(): \context {
        return \context_system::instance();
    }
    public function get_instance_context(int $instanceid = 0): \context {
        return \context_course::instance($instanceid);
    }
}
```

### Custom Fields XML in course.xml

```xml
<customfields>
  <customfield>
    <shortname>mycustomfield</shortname>
    <type>text</type>
    <value>Custom value here</value>
    <valueformat>0</valueformat>
  </customfield>
</customfields>
```

---

## 18. PRIVACY API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/privacy`

### Required Implementation

Every plugin must implement `\core_privacy\local\metadata\provider`:

**For plugins without personal data:**
```php
class provider implements \core_privacy\local\metadata\null_provider {
    public static function get_reason(): string {
        return 'privacy:metadata';
    }
}
```

**For plugins storing personal data:**
```php
class provider implements
    \core_privacy\local\metadata\provider,
    \core_privacy\local\request\plugin\provider {

    public static function get_metadata(collection $collection): collection {
        $collection->add_database_table('mymodule_submissions', [
            'userid'    => 'privacy:metadata:userid',
            'content'   => 'privacy:metadata:content',
            'timecreated' => 'privacy:metadata:timecreated',
        ], 'privacy:metadata:mymodule_submissions');
        return $collection;
    }

    public static function get_contexts_for_userid(int $userid): contextlist { ... }
    public static function export_user_data(approved_contextlist $contextlist): void { ... }
    public static function delete_data_for_all_users_in_context(\context $context): void { ... }
    public static function delete_data_for_user(approved_contextlist $contextlist): void { ... }
}
```

---

## 19. NAVIGATION API

**Reference:** `moodledev.io/docs/5.2/apis/core/navigation`

### Three Navigation Objects

```php
$PAGE->navigation   // Main navigation tree
$PAGE->settingsnav  // Settings navigation
$PAGE->navbar       // Breadcrumb
```

### Page Setup (required before navigation works)

```php
$PAGE->set_url('/mod/mymodule/view.php', ['id' => $cm->id]);
$PAGE->set_context($context);
$PAGE->set_cm($cm);
$PAGE->set_course($course);
$PAGE->set_title($page->name);
$PAGE->set_heading($course->fullname);
```

### Callback for Navigation Extension

```php
// In lib.php
function {modname}_extend_navigation(navigation_node $nav, stdClass $course,
                                      stdClass $module, cm_info $cm): void {
    $url = new moodle_url('/mod/{modname}/view.php', ['id' => $cm->id]);
    $nav->add('View', $url, navigation_node::TYPE_SETTING);
}
```

---

## 20. OUTPUT API & MUSTACHE TEMPLATES

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/output`

### Key Functions

```php
// Format content safely
$output = format_text($content, FORMAT_HTML, ['context' => $context]);
$output = format_string($name, true, ['context' => $context]);

// Render from template
$output = $OUTPUT->render_from_template('mod_mymodule/mytemplate', $context);
echo $OUTPUT->header();
echo $output;
echo $OUTPUT->footer();
```

### Mustache Template Syntax

```mustache
{{! Comment }}
{{variable}}              <!-- HTML-escaped output -->
{{{rawhtml}}}             <!-- Raw HTML (triple braces) -->
{{#section}}...{{/section}}   <!-- Conditional/loop -->
{{^section}}...{{/section}}   <!-- Inverted (if false/empty) -->
{{#str}}pluginname, mod_mymodule{{/str}}   <!-- Language string -->
{{#pix}}icon, mod_mymodule, Alt text{{/pix}}  <!-- Icon -->
{{> partial_template_name }}  <!-- Include partial -->
```

### Template Location

`mod/{modname}/templates/{templatename}.mustache`

---

## 21. FORMS API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/form`

### mod_form.php Structure

```php
class mod_{modname}_mod_form extends moodleform_mod {

    public function definition(): void {
        $mform = $this->_form;

        // Standard fields
        $mform->addElement('header', 'general', get_string('general', 'form'));
        $mform->addElement('text', 'name', get_string('name'));
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');

        $mform->addElement('editor', 'introeditor',
            get_string('moduleintro'), null, $this->get_editor_options());
        $mform->setType('introeditor', PARAM_RAW);

        // Custom fields
        $mform->addElement('select', 'myoption', get_string('myoption', '{modname}'),
            ['0' => get_string('no'), '1' => get_string('yes')]);
        $mform->setDefault('myoption', '0');

        // Standard course module elements (groups, completion, etc.)
        $this->standard_coursemodule_elements();
        $this->add_action_buttons();
    }

    public function validation($data, $files): array {
        $errors = parent::validation($data, $files);
        if (empty($data['name'])) {
            $errors['name'] = get_string('required');
        }
        return $errors;
    }
}
```

### Common Form Element Types

| Element | Usage |
|---------|-------|
| `text` | Single-line text |
| `textarea` | Multi-line text |
| `editor` | Rich text (TinyMCE/Atto) |
| `select` | Dropdown |
| `checkbox` | Single checkbox |
| `radio` | Radio buttons |
| `date_time_selector` | Date+time picker |
| `filemanager` | File upload/manage |
| `filepicker` | Single file pick |
| `autocomplete` | AJAX autocomplete |
| `hidden` | Hidden field |
| `header` | Collapsible section header |
| `static` | Static display text |

---

## 22. TASK API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/task`

### Scheduled Task Class

```php
namespace mod_mymodule\task;

class my_scheduled_task extends \core\task\scheduled_task {

    public function get_name(): string {
        return get_string('taskname', 'mod_mymodule');
    }

    public function execute(): void {
        global $DB;
        // Task logic here
        mtrace('Running my task...');
    }
}
```

### db/tasks.php Format

```php
$tasks = [
    [
        'classname'  => 'mod_mymodule\task\my_scheduled_task',
        'blocking'   => 0,
        'minute'     => '0',
        'hour'       => '2',
        'day'        => '*',
        'month'      => '*',
        'dayofweek'  => '*',
        'disabled'   => 0,
    ],
];
```

**Schedule field values:**
- `*` — any value
- `0-23` — specific value
- `*/5` — every 5 units
- `R` — random value (Moodle-specific, for load distribution)

### Adhoc Task

```php
$task = new \mod_mymodule\task\my_adhoc_task();
$task->set_custom_data(['itemid' => $id]);
$task->set_userid($userid);  // run as specific user
\core\task\manager::queue_adhoc_task($task);
```

---

## 23. CACHE API (MUC)

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/muc`

### Cache Types

| Type | Constant | Scope |
|------|----------|-------|
| Application | `cache_store::MODE_APPLICATION` | All users, all requests |
| Session | `cache_store::MODE_SESSION` | Single user session |
| Request | `cache_store::MODE_REQUEST` | Single request only |

### db/caches.php Format

```php
$definitions = [
    'mycache' => [
        'mode'        => cache_store::MODE_APPLICATION,
        'simplekeys'  => true,   // only simple string keys
        'simpledata'  => false,  // complex data allowed
        'ttl'         => 3600,   // seconds (use sparingly)
        'staticacceleration'     => true,  // also cache in memory
        'staticaccelerationsize' => 30,    // max memory items
    ],
];
```

### Usage

```php
$cache = cache::make('mod_mymodule', 'mycache');
$cache->set('key', $data);
$value = $cache->get('key');
$cache->delete('key');

// Batch operations
$cache->set_many(['k1' => $v1, 'k2' => $v2]);
$values = $cache->get_many(['k1', 'k2']);
```

---

## 24. HOOKS API (PSR-14)

**Reference:** `moodledev.io/docs/5.2/apis/core/hooks`

### Hook Class Pattern

```php
namespace mod_mymodule\hook;

final class after_activity_created {
    public function __construct(
        public readonly int $cmid,
        public readonly int $instanceid,
    ) {}
}
```

### Dispatching a Hook

```php
$hook = new \mod_mymodule\hook\after_activity_created(
    cmid: $cm->id,
    instanceid: $instance->id,
);
\core\di::get(\core\hook\manager::class)->dispatch($hook);
```

### db/hooks.php Registration

```php
$callbacks = [
    [
        'hook'     => \mod_mymodule\hook\after_activity_created::class,
        'callback' => [\local_myplugin\hook\callbacks::class, 'handle_activity_created'],
        'priority' => 500,
    ],
];
```

---

## 25. DEPENDENCY INJECTION API

**Reference:** `moodledev.io/docs/5.2/apis/core/di`

### Constructor Injection (preferred)

```php
class my_service {
    public function __construct(
        protected readonly \core\clock $clock,
        protected readonly \moodle_database $db,
    ) {}
}

// Instantiate via DI (auto-injects dependencies)
$service = \core\di::get(my_service::class);
```

### Container Access (legacy code)

```php
$clock  = \core\di::get(\core\clock::class);
$client = \core\di::get(\core\http_client::class);
```

### Hook for DI Configuration

```php
// In db/hooks.php
[
    'hook'     => \core\hook\di_configuration::class,
    'callback' => [\mod_mymodule\di_config::class, 'configure'],
]
```

---

## 26. EXTERNAL / WEB SERVICES API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/external`

### External Function Class Pattern

```php
namespace mod_mymodule\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_multiple_structure;
use core_external\external_value;

class get_items extends external_api {

    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'courseid' => new external_value(PARAM_INT, 'Course ID'),
            'options'  => new external_single_structure([
                'limit' => new external_value(PARAM_INT, 'Limit', VALUE_DEFAULT, 10),
            ], 'Options', VALUE_DEFAULT, []),
        ]);
    }

    public static function execute(int $courseid, array $options = []): array {
        // 1. Validate parameters
        $params = self::validate_parameters(self::execute_parameters(),
            ['courseid' => $courseid, 'options' => $options]);

        // 2. Validate context
        $context = \context_course::instance($params['courseid']);
        self::validate_context($context);

        // 3. Check capability
        require_capability('mod/mymodule:view', $context);

        // 4. Do work
        return ['items' => []];
    }

    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'items' => new external_multiple_structure(
                new external_single_structure([
                    'id'   => new external_value(PARAM_INT, 'Item ID'),
                    'name' => new external_value(PARAM_TEXT, 'Item name'),
                ])
            ),
        ]);
    }
}
```

### db/services.php Format

```php
$functions = [
    'mod_mymodule_get_items' => [
        'classname'   => 'mod_mymodule\external\get_items',
        'description' => 'Get items for a course',
        'type'        => 'read',
        'ajax'        => true,
        'services'    => [MOODLE_OFFICIAL_MOBILE_SERVICE],
        'capabilities' => 'mod/mymodule:view',
    ],
];

// Optional service bundle
$services = [
    'My Module Service' => [
        'functions'      => ['mod_mymodule_get_items'],
        'enabled'        => 0,
        'downloadfiles'  => 0,
        'uploadfiles'    => 0,
    ],
];
```

### PARAM_ Type Constants (for parameter validation)

| Constant | Meaning |
|----------|---------|
| `PARAM_INT` | Integer |
| `PARAM_FLOAT` | Float |
| `PARAM_TEXT` | Plain text (no HTML) |
| `PARAM_RAW` | Raw text (unsafe) |
| `PARAM_HTML` | HTML (cleaned) |
| `PARAM_BOOL` | Boolean |
| `PARAM_ALPHA` | Alphabetic only |
| `PARAM_ALPHANUMEXT` | Alphanumeric + _ - |
| `PARAM_URL` | Valid URL |
| `PARAM_PATH` | File path |
| `PARAM_EMAIL` | Email address |
| `PARAM_NOTAGS` | Strip all tags |
| `PARAM_CLEANHTML` | Clean HTML |

---

## 27. MESSAGE API

**Reference:** `moodledev.io/docs/5.2/apis/core/message`

### Sending a Message

```php
$message = new \core\message\message();
$message->component        = 'mod_mymodule';
$message->name             = 'submission';
$message->userfrom         = core_user::get_support_user();
$message->userto           = $user;
$message->subject          = 'New submission';
$message->fullmessage      = 'Full message text...';
$message->fullmessageformat = FORMAT_PLAIN;
$message->fullmessagehtml  = '<p>Full message HTML...</p>';
$message->smallmessage     = 'Short notification text';
$message->notification     = 1;  // 1=notification, 0=user message
$message->contexturl       = (new moodle_url('/mod/mymodule/view.php', ['id' => $cmid]))->out(false);
$message->contexturlname   = 'View submission';

message_send($message);
```

### db/messages.php Format

```php
$messageproviders = [
    'submission' => [
        'defaults' => [
            'popup'  => MESSAGE_PERMITTED + MESSAGE_DEFAULT_ENABLED,
            'email'  => MESSAGE_PERMITTED,
        ],
        'capability' => 'mod/mymodule:viewsubmissions',
    ],
];
```

---

## 28. COMMUNICATION API (BigBlueButton / Matrix)

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/communication`

### Loading and Using a Communication Instance

```php
$communication = \core_communication\api::load_by_instance(
    context: $context,
    component: 'mod_mymodule',
    instancetype: 'mymodule',
    instanceid: $instance->id,
    provider: 'communication_matrix'  // or 'communication_bbb'
);

// Create room
$communication->create_and_configure_room(
    communicationroomname: $instance->name,
    instance: $instance,
);

// Add members
$communication->add_members_to_room(userids: [$userid1, $userid2]);

// Get room URL for users
$url = $communication->get_communication_room_url();
```

**Note:** Actions are asynchronous (run as adhoc tasks). Requires `enablecommunicationsubsystem` enabled in site config.

---

## 29. ANALYTICS API

**Reference:** `moodledev.io/docs/5.2/apis/subsystems/analytics`

### Key Concepts

- **Indicators** — measurable predictive factors (e.g., login frequency, grade trends)
- **Targets** — events to predict (e.g., course dropout, no teaching activity)
- **Predictions** — generated insights visible to users with appropriate permissions
- **Insights** — notifications sent to relevant users with suggested actions

### Built-in Models

1. Students at risk of dropping out
2. Courses without teaching activity

### Practical Integration

Courses must have `startdate`/`enddate` set for time-based analysis. Models require enabling in Site Admin → Analytics → Analytics models.

---

## 30. PLUGIN TYPES REFERENCE

**Reference:** `moodledev.io/docs/5.2/apis/plugintypes`

| Plugin Type | Directory | Component Prefix | Since |
|-------------|-----------|-----------------|-------|
| Activity modules | `/mod` | `mod_` | 1.0 |
| Blocks | `/blocks` | `block_` | 2.0 |
| Course formats | `/course/format` | `format_` | 2.0 |
| Enrolment | `/enrol` | `enrol_` | 2.0 |
| Authentication | `/auth` | `auth_` | 1.0 |
| Question types | `/question/type` | `qtype_` | 1.0 |
| Question bank | `/question/bank` | `qbank_` | 4.0 |
| Availability | `/availability/condition` | `availability_` | 2.7 |
| Custom fields | `/customfield/field` | `customfield_` | 3.7 |
| Repository | `/repository` | `repository_` | 2.0 |
| Filter | `/filter` | `filter_` | 1.0 |
| Local plugins | `/local` | `local_` | 2.0 |
| TinyMCE plugins | `/lib/editor/tiny/plugins` | `tiny_` | 4.1 |
| Antivirus | `/lib/antivirus` | `antivirus_` | 3.1 |
| File converters | `/files/converter` | `fileconverter_` | 3.2 |
| Logstore | `/admin/tool/log/store` | `logstore_` | 2.7 |
| Themes | `/theme` | `theme_` | 1.0 |
| Assignment submission | `/mod/assign/submission` | `assignsubmission_` | 2.3 |
| Assignment feedback | `/mod/assign/feedback` | `assignfeedback_` | 2.3 |
| Quiz access rules | `/mod/quiz/accessrule` | `quizaccess_` | 2.2 |

---

## 31. COMMON PLUGIN FILES REFERENCE

**Reference:** `moodledev.io/docs/5.2/apis/commonfiles`

### Required Files (all plugins)

| File | Purpose |
|------|---------|
| `version.php` | Metadata: component, version, requires, maturity, release |
| `lang/en/{frankenstyle}.php` | Language strings; must define `$string['pluginname']` |

### Database Files (db/ directory)

| File | Purpose |
|------|---------|
| `db/install.xml` | XMLDB schema — tables, fields, indexes, keys |
| `db/upgrade.php` | Upgrade steps; function `xmldb_{frankenstyle}_upgrade($oldversion)` |
| `db/access.php` | Capabilities; `$capabilities` array |
| `db/install.php` | Post-install hook (not called on upgrade) |
| `db/uninstall.php` | Pre-uninstall hook |
| `db/events.php` | Event observer registration; `$observers` array |
| `db/messages.php` | Message provider definitions; `$messageproviders` array |
| `db/services.php` | Web service declarations; `$functions` and `$services` arrays |
| `db/tasks.php` | Scheduled task definitions; `$tasks` array |
| `db/caches.php` | Cache definitions; `$definitions` array |
| `db/tag.php` | Tag area definitions; `$tagareas` array |
| `db/hooks.php` | Hook callbacks; `$callbacks` array |
| `db/renamedclasses.php` | Maps old → new class names for autoloader |

### Code Organization

| Path | Purpose |
|------|---------|
| `lib.php` | Legacy callbacks; keep minimal |
| `locallib.php` | Legacy support functions; deprecated pattern |
| `classes/` | PSR-4 autoloaded PHP classes |
| `classes/external/` | Web service function classes |
| `classes/task/` | Scheduled/adhoc task classes |
| `classes/privacy/provider.php` | Privacy API implementation |
| `classes/event/` | Event classes |
| `cli/` | Command-line scripts |
| `backup/moodle2/` | Backup and restore classes |
| `templates/` | Mustache templates |
| `amd/src/` | JavaScript AMD/ESM modules |
| `pix/` | Plugin images/icons |
| `styles.css` | Plugin CSS |
| `settings.php` | Admin settings page |

---

## 32. COURSE FORMAT PLUGINS

**Reference:** `moodledev.io/docs/5.2/apis/plugintypes/format`

### Directory Structure

```
course/format/{formatname}/
├── format.php          ← Course layout renderer
├── lib.php             ← format_{formatname} class
├── version.php
├── lang/en/format_{formatname}.php
└── classes/output/renderer.php   ← extends section_renderer
```

### Core Format Class Methods

```php
class format_topics extends core_courseformat\base {
    public function uses_sections(): bool { return true; }
    public function uses_course_index(): bool { return true; }
    public function supports_components(): bool { return true; }  // reactive UI
    public function get_section_name(section_info|int $section): string { ... }
    public function can_delete_section(int|section_info $section): bool { ... }

    // Custom course-level options
    public function course_format_options(bool $foreditform = false): array {
        return [
            'hiddensections' => [
                'default' => 0,
                'type'    => PARAM_INT,
            ],
            'coursedisplay' => [
                'default' => COURSE_DISPLAY_SINGLEPAGE,
                'type'    => PARAM_INT,
            ],
        ];
    }
}
```

### Common Format Names

| format | Description |
|--------|-------------|
| `topics` | Topic-based sections (most common) |
| `weeks` | Week-based sections with dates |
| `social` | Single forum |
| `singleactivity` | One activity only |

---

## 33. BLOCK PLUGINS

**Reference:** `moodledev.io/docs/5.2/apis/plugintypes/blocks`

### Required Files

```
blocks/{blockname}/
├── block_{blockname}.php   ← Main block class
├── version.php
├── lang/en/block_{blockname}.php
└── db/access.php
```

### Block Class Methods

```php
class block_myblock extends block_base {

    public function init(): void {
        $this->title = get_string('pluginname', 'block_myblock');
    }

    public function get_content(): stdClass {
        if ($this->content !== null) {
            return $this->content;
        }
        $this->content = new stdClass();
        $this->content->text = '<p>Block content</p>';
        $this->content->footer = '';
        return $this->content;
    }

    public function applicable_formats(): array {
        return [
            'course-view' => true,
            'mod'         => false,
            'my'          => true,
        ];
    }
}
```

### Block Backup Files

```
blocks/{blockname}/backup/moodle2/
├── backup_{blockname}_block_task.class.php
└── restore_{blockname}_block_task.class.php
```

---

## 34. AVAILABILITY CONDITION PLUGINS

**Reference:** `moodledev.io/docs/5.2/apis/plugintypes/availability`

### Required Files

```
availability/condition/{conditionname}/
├── classes/condition.php   ← Backend logic
├── classes/frontend.php    ← Form integration
├── version.php
└── lang/en/availability_{conditionname}.php
    (must define: pluginname, title, description)
```

### Condition Class

```php
class condition extends \core_availability\condition {

    // Called to check if user meets the condition
    public function is_available(bool $not, info $info, bool $grabthelot, int $userid): bool {
        // Return true if user can access, false otherwise
        // $not = true means invert the logic
    }

    // Human-readable description
    public function get_description(bool $full, bool $not, info $info): string {
        return get_string($not ? 'requires_not' : 'requires', 'availability_mycond');
    }

    // Serialize for storage
    public function save(): stdClass {
        return (object)['type' => 'mycond', 'myvalue' => $this->myvalue];
    }

    // Deserialize from stored JSON
    public function __construct(stdClass $structure) {
        $this->myvalue = $structure->myvalue;
    }
}
```

---

## 35. MISCELLANEOUS APIs

### Clock API

```php
$clock = \core\di::get(\core\clock::class);
$now   = $clock->now();       // DateTimeImmutable
$ts    = $clock->time();      // Unix timestamp int
```

### Time API

```php
$ts  = time();                          // current Unix timestamp
$str = userdate($ts, '%d %B %Y');       // user-timezone formatted date
$mid = usergetmidnight($ts, $tz);       // midnight for user's timezone
$tz  = usertimezone();                  // user's timezone string
```

**All times stored as Unix timestamps.** Format codes are `strftime()` style.

### Preference API

```php
// Get (returns null or $default if not set)
$value = get_user_preferences('mymodule_mykey', $default, $userid);

// Set
set_user_preference('mymodule_mykey', $value, $userid);

// Multiple
set_user_preferences(['key1' => 'val1', 'key2' => 'val2'], $userid);

// Delete
unset_user_preference('mymodule_mykey', $userid);
```

### Favourites API

```php
$usercontext = context_user::instance($userid);
$ufservice   = \core_favourites\service_factory::get_service_for_user_context($usercontext);

$ufservice->create_favourite('mod_mymodule', 'item', $itemid, $context);
$ufservice->delete_favourite('mod_mymodule', 'item', $itemid, $context);
$favs = $ufservice->find_favourites_by_type('mod_mymodule', 'item');
```

### Lock API

```php
$lockfactory = \core\lock\lock_config::get_lock_factory('mod_mymodule');
$lock = $lockfactory->get_lock('resource_key', 30);  // 30 second timeout
if ($lock) {
    try {
        // Protected operation
    } finally {
        $lock->release();  // ALWAYS release
    }
}
```

### Check API

Checks implement `\core\check\check`:

```php
class mycheck extends \core\check\check {
    public function get_result(): \core\check\result {
        if (/* problem */) {
            return new \core\check\result(
                \core\check\result::ERROR,
                get_string('checkfailed', 'mod_mymodule')
            );
        }
        return new \core\check\result(\core\check\result::OK, get_string('checkpassed', 'mod_mymodule'));
    }
}
```

### HTML Writer

```php
// Simple elements
echo html_writer::tag('p', 'Content', ['class' => 'myclass', 'id' => 'myid']);
echo html_writer::div('Content', 'classname');
echo html_writer::start_tag('div', ['class' => 'wrapper']);
echo html_writer::end_tag('div');
echo html_writer::empty_tag('input', ['type' => 'text', 'name' => 'q']);
echo html_writer::link($url, 'Click here', ['class' => 'btn']);
```

### Deprecation API

```php
use \core\attribute\deprecated;

#[deprecated(
    replacement: 'new_function_name',
    since: '5.2',
    reason: 'Use the new API instead',
    mdl: 'MDL-12345',
    final: false,
)]
function old_function(): void {
    \core\deprecation::emit_deprecation_if_present(__FUNCTION__);
    // legacy code
}
```

---

## 36. MOODLE 5.2 SPECIFIC CHANGES

**Reference:** `moodledev.io/docs/5.2/devupdate`

### Code Restructure (5.1+)

- Web-accessible files moved to `public/` subdirectory
- `$CFG->root` — new read-only variable pointing to installation root
- `$CFG->wwwroot` and `$CFG->dirroot` unchanged
- Web server `DocumentRoot` / `root` must point to `{moodle}/public/`

### Activity Chooser Descriptions (New in 5.2)

New optional language strings for activity chooser:
```php
$string['modulename_summary'] = 'One paragraph introduction.';
$string['modulename_help'] = 'Detailed description with Key features and Ways to use it.';
$string['modulename_tip'] = 'Best practices and usage advice.';
```

### Badges API Reorganization

- JSON exporters refactored to support multiple Open Badges schema versions
- Better compatibility across different Open Badges standards

### Frontend Changes

- ESM/TypeScript/React now supported as the modern frontend stack
- Components in `component/js/esm/src/` (TypeScript)
- Custom reactive UI deprecated for new features — use React instead
- `core/dropzone` module for drag-and-drop (since 4.4)

### DI / Clock

- `\core\clock` interface (PSR-20 compatible) introduced in 4.4
- Full DI container (PSR-11 / PHP-DI) introduced in 4.4
- Hooks API (PSR-14) replacing lib.php callbacks

### Blocking Tasks Removed (4.4)

- `blocking` field in tasks.php is deprecated/rejected in core
- Legacy cron (`cron.php`, `modname_cron()`) removed in 4.3

---

## APPENDIX A: TEXT FORMAT CODES

| Code | Constant | Description |
|------|----------|-------------|
| 0 | FORMAT_MOODLE | Legacy Moodle auto-format |
| 1 | FORMAT_HTML | HTML |
| 2 | FORMAT_PLAIN | Plain text |
| 4 | FORMAT_MARKDOWN | Markdown |

---

## APPENDIX B: KEY XML SENTINEL VALUES

| Value | Meaning |
|-------|---------|
| `$@NULL@$` | SQL NULL |
| `$@EMPTY@$` | Empty string (distinct from NULL) |
| `$@COURSEVIEWBYID*N@$` | Encoded course view URL (id=N) |
| `$@PAGEVIEWBYID*N@$` | Encoded page view URL |
| `$@FORUMVIEWBYID*N@$` | Encoded forum view URL |

---

## APPENDIX C: ROLE IDs (Default Moodle Roles)

| roleid | archetype | Name |
|--------|-----------|------|
| 1 | manager | Manager |
| 2 | coursecreator | Course creator |
| 3 | editingteacher | Teacher (editing) |
| 4 | teacher | Non-editing teacher |
| 5 | student | Student |
| 6 | guest | Guest |
| 7 | user | Authenticated user |
| 8 | frontpage | Frontpage |

---

## APPENDIX D: CONTEXT LEVELS

| Constant | Value | Description |
|----------|-------|-------------|
| `CONTEXT_SYSTEM` | 10 | System-wide |
| `CONTEXT_USER` | 30 | User profile |
| `CONTEXT_COURSECAT` | 40 | Course category |
| `CONTEXT_COURSE` | 50 | Course |
| `CONTEXT_MODULE` | 70 | Activity module |
| `CONTEXT_BLOCK` | 80 | Block |

---

## APPENDIX E: MINIMUM .mbz FILE CHECKLIST

For a valid, importable .mbz course backup the following must be present:

### Required Files
- [ ] `moodle_backup.xml` — manifest with `<information>` block
- [ ] `course/course.xml` — course record
- [ ] `sections/section_0/section.xml` — section 0 (always exists)

### Required XML Elements in moodle_backup.xml
- [ ] `<moodle_version>` — must be a valid Moodle version integer
- [ ] `<backup_version>` — matches moodle_version or earlier
- [ ] `<original_course_id>` — any integer
- [ ] `<contents>` block with `<course>`, `<sections>`, `<activities>`, `<blocks>`
- [ ] `<settings>` block with at minimum `filename` setting

### Per Activity (in `activities/{modname}_{cmid}/`)
- [ ] `{modname}.xml` — activity data
- [ ] `grades.xml` — even if empty (`<activity_gradebook><grade_items/></activity_gradebook>`)
- [ ] `inforef.xml` — even if empty (`<inforef/>`)
- [ ] `calendar.xml` — even if empty (`<events/>`)

### For Sections
- [ ] Each section listed in manifest must have `sections/section_{id}/section.xml`
- [ ] `<sequence>` in section.xml must list cmids of activities in that section

### For Files (embedded content)
- [ ] Binary file content in `files/` named by SHA-1 content hash
- [ ] File record referenced in `inforef.xml` of the owning activity

---

*End of Moodle 5.2 Developer API Reference*
