---
# ===================================================================
# Docusaurus Control Fields
# ===================================================================
title: 'Release Notes: Zebra Aurora Focus 10.0.15'
description: 'A summary of new features, fixes, and other updates for Zebra Aurora Focus version 10.0.15.'
keywords: ["release notes", "Aurora Focus", "Machine Vision", "10.0.15"]
sidebar_label: '10.0.15 Release Notes'
slug: /releases/aurora-focus/10.0.15

# ===================================================================
# Content Management & Display Fields
# ===================================================================
status: 'Published'
version: '10.0.15'
author: '[Author ID]'
sort_order: 100
last_updated: '(Automated by build process)'
last_reviewed: '2024-05-21'

# ===================================================================
# Core Taxonomy Fields (For Filtering)
# ===================================================================

# --- Product & Software Filters ---
product_name: 'Aurora Focus'
product_family: 'Machine Vision'
product_series: 'FS10, FS20, GS20, xS20, xS40, FS42, NS42, xS70, FS70, VS70, FS80'
software_tool: 'Aurora Focus'
component_type: 'Firmware'

# --- Use Case & Device Filters ---
use_case: ['Deep Learning', 'Barcode Decoding', 'System Maintenance', 'Image Processing']
license_type: '[License Type]'
device_type: 'Smart Camera, Fixed Scanner'

# --- User-Centric Filters ---
role: ['Integrator/Developer', 'System Administrator', 'Controls Engineer']
task: 'System Maintenance'
content_type: 'Release Notes'
skill_level: 'All'

---

# Release Notes: Zebra Aurora Focus 10.0.15

This release of Zebra Aurora Focus (V10.0.15) introduces significant enhancements, including the ability to save intermediate images, view timestamps in the results log, decode multiple 1D barcodes simultaneously, and adds support for the Zebra Integrated Multi-Function Light (ZIML) on FS42 2MP devices. It also features improvements to JavaScript capabilities and overall system stability.

## Important Notes

*   **FS80 Upgrade/Downgrade:** Full upgrades contain large files that require longer installation times. Do not pull power to the device during the upgrade. After upgrading the FS80 to the 10.0 release, downgrades can no longer be completed with an incremental update package and must be done with the full upgrade package. To downgrade from 10.0, install the 9.1 Full Update Firmware first, and then to the required firmware if different than 9.1.
*   **Rolling Shutter Support:** Rolling Shutter is no longer supported on xS40-70 (5MP) devices.

## Software and Firmware Versions

This table provides a clear reference for all component versions included in the release bundle.

| Component | Version |
| --- | --- |
| Aurora Focus | 10.0.15 |
| Aurora Focus HMI | 10.0.33 |
| Connectivity Gateway | 1.3.6 |
| Aurora Deep Learning | 9.4.11193 |
| (BSP) GS20 | 10.0.723 - CAAGDS00-008-R1 |
| (BSP) FS40, VS40, FS70, VS70 | 10.0.723 - CAAESS00-008-R1 |
| (BSP) FS42, NS42 | 10.0.723 - CAAGGS00-008-R1 |
| (BSP) FS10, FS20, VS20 | 10.0.723 - CAAFFS00-0068R1 |
| (BSP) FS80 | 10.0.414 - SAAHMS00-002-R01 |

## New Features

*   **Save Image Enhancements:** `[DCH-14673]` Save intermediate images for continuous and aggregate modes that process multiple frames during execution. This is useful for troubleshooting partial image sequences to understand why misdecodes occur.
*   **View Timestamps in the Results Log:** `[DCH-20859]` Timestamps are now viewable to the millisecond in the Results Log, aligning with the results history in the WebHMI.
*   **Decode Multiple 1D Barcodes Simultaneously:** `[DCH-25695]` Datacode now supports simultaneous decode of multiple 1D symbologies. The Datacode tool is also now compatible with ImagePerfect, providing the ability to program a sequence of read attempts with different acquisition banks.
*   **Byte Swap Support:** `[DCH-23899]` Support to access the Industrial Ethernet data structure to toggle the byte order before sending it, supporting Keyence PLC. The byte swap option is provided for all string type IE attributes.
*   **Zebra Integrated Multi-Function Light (ZIML) Support on FS42 2MP:** `[DCH-26089]` Support for using FS42 2MP devices with the ZIML without Hidden Strobe.
*   **Sensor Windowing:** `[DCH-12982]` Image sensor partial scanning and sensor ROI windowing improves speed for high-speed applications by reducing image acquisition time and enhancing image transfer efficiency.
*   **Callback Functions Using JavaScript:** `[DCH-24103]` Added JavaScript callback support for GPIO, TCPIP and Serial port imports.
*   **Additional JavaScript Enhancements:**
    *   Binarization, Brightness, Pixel Count, and Morphological Tools
    *   Locate and Measure Circle Tools
    *   Blob and Flaw Detection
    *   Distance and Pattern Match

## Bug Fixes

*   `[MVFIS-2256]` Resolved an issue to ensure licensing status remains synchronized and accurate.
*   `[MVFIS-2231]` Improved Pharmacode decoding to successfully read symbols with uniform bar widths.
*   `[MVFIS-2209]` Increased the stability of the Connectivity Gateway to prevent random device connection loss.
*   `[MVFIS-2207]` Addressed an issue in the Deep Learning OCR tool to improve the reliability of character search.
*   `[MVFIS-2186]` Resolved an issue to ensure licensing status remains synchronized and accurate.
*   `[MVFIS-2160]` Improved device stability to prevent reboots on the FS42 when using a 24V trigger.
*   `[MVFIS-2145]` Updated tooltips to provide accurate guidance when the Automation Wedge feature is active.
*   `[MVFIS-2111]` Improved FTP connection reliability for FS80 devices.
*   `[MVFIS-2018]` Improved decoding performance on the FS10 for challenging labels and DataMatrix codes.
*   `[MVFIS-1946]` Updated the Industrial Ethernet/IP EDS file to add support for xS42 devices.
*   `[MVFIS-1789]` Corrected an issue where a device would incorrectly report a job as running after a device backup.
*   `[MVFIS-2206]` Improved the performance of the WebHMI to provide a real-time display of results and images.

## Known Issues and Workarounds

No known issues are reported for this release.
