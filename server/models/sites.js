const Model = require('objection').Model
const crypto = require('crypto')
const pem2jwk = require('pem-jwk').pem2jwk
const _ = require('lodash')

/* global WIKI */

/**
 * Site model
 */
module.exports = class Site extends Model {
  static get tableName () { return 'sites' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['hostname'],

      properties: {
        id: { type: 'string' },
        hostname: { type: 'string' },
        isEnabled: { type: 'boolean', default: false }
      }
    }
  }

  static get jsonAttributes () {
    return ['config']
  }

  static async getSiteByHostname ({ hostname, forceReload = false }) {
    if (forceReload) {
      await WIKI.models.sites.reloadCache()
    }
    const siteId = WIKI.sitesMappings[hostname] || WIKI.sitesMappings['*']
    if (siteId) {
      return WIKI.sites[siteId]
    }
    return null
  }

  static async reloadCache () {
    WIKI.logger.info('Reloading site configurations...')
    const sites = await WIKI.models.sites.query().orderBy('id')
    WIKI.sites = _.keyBy(sites, 'id')
    WIKI.sitesMappings = {}
    for (const site of sites) {
      WIKI.sitesMappings[site.hostname] = site.id
    }
    WIKI.logger.info(`Loaded ${sites.length} site configurations [ OK ]`)
  }

  static async createSite (hostname, config) {
    const newSite = await WIKI.models.sites.query().insertAndFetch({
      hostname,
      isEnabled: true,
      config: _.defaultsDeep(config, {
        title: 'My Wiki Site',
        description: '',
        company: '',
        contentLicense: '',
        footerExtra: '',
        pageExtensions: ['md', 'html', 'txt'],
        defaults: {
          timezone: 'America/New_York',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: '12h'
        },
        features: {
          ratings: false,
          ratingsMode: 'off',
          comments: false,
          contributions: false,
          profile: true,
          search: true
        },
        logoUrl: '',
        logoText: true,
        sitemap: true,
        robots: {
          index: true,
          follow: true
        },
        locale: 'en',
        localeNamespacing: false,
        localeNamespaces: [],
        theme: {
          dark: false,
          colorPrimary: '#1976d2',
          colorSecondary: '#02c39a',
          colorAccent: '#f03a47',
          colorHeader: '#000000',
          colorSidebar: '#1976d2',
          injectCSS: '',
          injectHead: '',
          injectBody: '',
          sidebarPosition: 'left',
          tocPosition: 'right',
          showSharingMenu: true,
          showPrintBtn: true,
          baseFont: 'roboto',
          contentFont: 'roboto'
        }
      })
    })

    WIKI.logger.debug(`Creating new DB storage for site ${newSite.id}`)

    await WIKI.models.storage.query().insert({
      module: 'db',
      siteId: newSite.id,
      isEnabled: true,
      contentTypes: {
        activeTypes: ['pages', 'images', 'documents', 'others', 'large'],
        largeThreshold: '5MB'
      },
      assetDelivery: {
        streaming: true,
        directAccess: false
      },
      state: {
        current: 'ok'
      }
    })

    return newSite
  }

  static async updateSite (id, patch) {
    return WIKI.models.sites.query().findById(id).patch(patch)
  }

  static async deleteSite (id) {
    await WIKI.models.storage.query().delete().where('siteId', id)
    return WIKI.models.sites.query().deleteById(id)
  }
}
