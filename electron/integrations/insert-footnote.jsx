/* Quran Reader - InDesign footnote bridge.
 * ExtendScript ES3-compatible: designed for InDesign CC 2018 (13.x) and later.
 * The script is loaded by insert-footnote.ps1 and receives its JSON payload below.
 */
var quranPayload = __QURAN_PAYLOAD_JSON__;

(function () {
    function quranHasType(object, expected) {
        try {
            if (object && object.constructor && object.constructor.name === expected) return true;
        } catch (e1) {}
        try {
            if (object && object.reflect && object.reflect.name === expected) return true;
        } catch (e2) {}
        return false;
    }

    function quranFindFootnote(object) {
        var current = object;
        var depth;
        for (depth = 0; depth < 20 && current; depth += 1) {
            try {
                if (quranHasType(current, 'Footnote') && current.isValid) {
                    return current;
                }
            } catch (e1) {}
            try {
                var parent = current.parent;
                if (!parent || parent === current) break;
                current = parent;
            } catch (e2) {
                break;
            }
        }
        return null;
    }

    function quranIsInsertionPoint(object) {
        return quranHasType(object, 'InsertionPoint');
    }

    function quranIsTextRange(object) {
        return quranHasType(object, 'Text') ||
            quranHasType(object, 'TextStyleRange') ||
            quranHasType(object, 'Word') ||
            quranHasType(object, 'Character') ||
            quranHasType(object, 'Line') ||
            quranHasType(object, 'Paragraph') ||
            quranHasType(object, 'TextColumn');
    }

    function quranIsEditableTextTarget(object) {
        return quranIsInsertionPoint(object) || quranIsTextRange(object);
    }

    function quranRunInsert() {
        if (!quranPayload || !quranPayload.text || !quranPayload.reference) {
            return 'QURAN_ERROR|INVALID_PAYLOAD';
        }
        if (!app.documents || app.documents.length < 1) {
            return 'QURAN_ERROR|NO_DOCUMENT';
        }

        var doc = app.activeDocument;
        if (!doc || !doc.isValid) {
            return 'QURAN_ERROR|NO_DOCUMENT';
        }
        if (!app.selection || app.selection.length < 1 || !app.selection[0]) {
            return 'QURAN_ERROR|NO_SELECTION';
        }

        var target = app.selection[0];
        if (!quranIsEditableTextTarget(target)) {
            return 'QURAN_ERROR|TEXT_REQUIRED';
        }

        var insertText = String(quranPayload.text);
        var referenceText = String(quranPayload.reference);
        var footnoteContext = quranFindFootnote(target);

        /*
         * A selection inside an existing InDesign footnote must stay in that footnote.
         * A nested footnote is not supported by InDesign, so put the address in ordinary
         * text immediately after the ayah instead of creating a new main-story footnote.
         */
        if (footnoteContext) {
            var oldFootnoteContents = '';
            try {
                oldFootnoteContents = String(target.contents);
            } catch (readError) {}

            try {
                target.contents = insertText + ' ' + referenceText;
            } catch (writeError) {
                try { target.contents = oldFootnoteContents; } catch (restoreError) {}
                return 'QURAN_ERROR|FOOTNOTE_WRITE_FAILED';
            }

            /* Keep the insertion point in the existing footnote for the next operation. */
            try {
                var footnoteEnd = footnoteContext.insertionPoints.item(-1);
                if (footnoteEnd && footnoteEnd.isValid) app.select(footnoteEnd);
            } catch (caretError) {
                /* The inserted text is already safe; caret restoration is non-critical. */
            }

            return 'QURAN_OK_EXISTING_FOOTNOTE';
        }

        var story = null;
        var startIndex = -1;
        if (quranIsInsertionPoint(target)) {
            story = target.parentStory;
            startIndex = Number(target.index);
        } else if (quranIsTextRange(target)) {
            story = target.parentStory;
            if (target.insertionPoints && target.insertionPoints.length > 0) {
                startIndex = Number(target.insertionPoints.item(0).index);
            }
        }

        if (!story || !story.isValid || startIndex < 0) {
            return 'QURAN_ERROR|STORY_INVALID';
        }

        var storyId = Number(story.id);
        var originalContents = '';
        try {
            originalContents = String(target.contents);
        } catch (contentsError) {}

        var footnote = null;
        try {
            /* Replace a text selection, or insert at the active insertion point. */
            target.contents = insertText;

            /* Re-resolve the story after mutation; old InDesign specifiers can become stale. */
            story = doc.stories.itemByID(storyId);
            if (!story || !story.isValid) throw new Error('STORY_INVALID');

            var endIndex = startIndex + insertText.length;
            var endPoint = story.insertionPoints.item(endIndex);
            if (!endPoint || !endPoint.isValid) throw new Error('STORY_INVALID');

            footnote = endPoint.footnotes.add();
            if (!footnote || !footnote.isValid) throw new Error('INSERT_FAILED');

            footnote.insertionPoints.item(-1).contents = referenceText;
        } catch (insertError) {
            /* Roll back the text and any partially-created footnote before reporting failure. */
            try {
                if (footnote && footnote.isValid) footnote.remove();
            } catch (removeError) {}
            try {
                story = doc.stories.itemByID(storyId);
                if (story && story.isValid) {
                    var lastInsertedIndex = startIndex + insertText.length - 1;
                    if (lastInsertedIndex >= startIndex) {
                        story.characters.itemByRange(startIndex, lastInsertedIndex).contents = originalContents;
                    }
                }
            } catch (rollbackError) {}

            if (insertError && insertError.message === 'STORY_INVALID') {
                return 'QURAN_ERROR|STORY_INVALID';
            }
            return 'QURAN_ERROR|INSERT_FAILED';
        }

        /* Restore the caret to the main story after the marker for repeated insertions. */
        try {
            var marker = footnote.storyOffset;
            if (marker && marker.isValid) {
                var markerIndex = Number(marker.index);
                story = doc.stories.itemByID(storyId);
                if (story && story.isValid) {
                    var nextIndex = markerIndex + 1;
                    var lastIndex = story.insertionPoints.length - 1;
                    if (nextIndex > lastIndex) nextIndex = lastIndex;
                    if (nextIndex >= 0) app.select(story.insertionPoints.item(nextIndex));
                }
            }
        } catch (restoreCaretError) {
            /* The footnote already exists; a caret-restore failure must not trigger fallback. */
        }

        return 'QURAN_OK_NATIVE_FOOTNOTE';
    }

    try {
        return app.doScript(
            quranRunInsert,
            ScriptLanguage.JAVASCRIPT,
            undefined,
            UndoModes.ENTIRE_SCRIPT,
            'Insert Quran footnote'
        );
    } catch (scriptError) {
        return 'QURAN_ERROR|INSERT_FAILED';
    }
})();
