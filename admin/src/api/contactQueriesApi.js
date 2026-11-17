import axios from 'axios'
import { getApiBase } from '@shared/config/apiBase.js'

const base = getApiBase()

export class ContactQueriesError extends Error {}

function fail(error, fallback) {
  const message = error?.response?.data?.message
  throw new ContactQueriesError(typeof message === 'string' ? message : fallback)
}

export async function loadContactQueries() {
  try {
    const { data } = await axios.get(`${base}/api/admin/contact-queries.php`)
    return Array.isArray(data?.queries) ? data.queries : []
  } catch (error) {
    fail(error, 'Contact queries could not be loaded.')
  }
}

export async function replyContactQuery({ queryId, message, markContacted = true }) {
  try {
    const { data } = await axios.post(`${base}/api/admin/contact-queries.php`, {
      action: 'reply',
      id: queryId,
      message,
      markContacted,
    })
    return {
      query: data?.query || null,
      queries: Array.isArray(data?.queries) ? data.queries : [],
    }
  } catch (error) {
    fail(error, 'Response could not be saved.')
  }
}

export async function setContactQueryStatus(queryId, status) {
  try {
    const { data } = await axios.post(`${base}/api/admin/contact-queries.php`, {
      action: 'set-status',
      id: queryId,
      status,
    })
    return {
      query: data?.query || null,
      queries: Array.isArray(data?.queries) ? data.queries : [],
    }
  } catch (error) {
    fail(error, 'Status could not be updated.')
  }
}