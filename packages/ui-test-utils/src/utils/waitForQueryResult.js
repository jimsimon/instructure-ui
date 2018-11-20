/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 - present Instructure, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { elementToString } from './elementToString'
import debounce from '@instructure/debounce'

// original source: https://github.com/kentcdodds/dom-testing-library/blob/master/src/wait-for-element.js
// this doesn't require the mutation observer shim because we don't run the tests with JSDOM
export function waitForQueryResult (
  query,
  {
    element,
    timeout = 1900,
    expectEmpty = false,
    mutationObserverOptions = { attributes: true, childList: true, subtree: true },
    message = false
  } = {},
) {
  if (typeof element === 'undefined') {
    if (typeof document === 'undefined') {
     throw new Error('[ui-test-utils] Could not find a valid HtmlElement for query.')
    } else {
     // eslint-disable-next-line no-param-reassign
     element = document.body
    }
  }

  return new Promise((resolve, reject) => {
    const debouncedQuery = debounce(runQuery, 10, { leading: false, trailing: true })

    let lastError, observer, timer

    function runQuery () {
      if (typeof query !== 'function') {
        onDone(new Error([
          '[ui-test-utils] Invalid element query.',
          JSON.stringify(query)
        ].join('\n')),  [])
        return
      }

      try {
        const result = query() || []
        if (
          (!expectEmpty && result.length > 0) ||
          (expectEmpty && result.length === 0)
        ) {
          // Return the query result when we get what we expected:
          onDone(null, result)
        }
      } catch (e) {
        // If `query` throws an error, wait for the next mutation or timeout.
        // Save the query error to reject the promise with it.
        lastError = e
      }
    }

    function onDone (e, result) {
      clearTimeout(timer)
      setImmediate(() => observer.disconnect())
      debouncedQuery.cancel()

      if (e) {
        reject(e)
      } else {
        resolve(result)
      }
    }

    function onMutation (mutationTarget) {
      debouncedQuery()
    }

    function onTimeout () {
      const timedoutError = new Error(
        [
          `[ui-test-utils] Timed out waiting for Element query results...`,
          message,
          `element: ${elementToString(element, 7000, { highlight: false })}`
        ]
          .filter(Boolean).join('\n')
      )
      onDone(lastError || timedoutError, [])
    }

    timer = setTimeout(onTimeout, timeout)
    observer = new MutationObserver(onMutation)
    observer.observe(element, mutationObserverOptions)

    runQuery()
  })
}