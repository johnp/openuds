# -*- coding: utf-8 -*-

#
# Copyright (c) 2012 Virtual Cable S.L.
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without modification,
# are permitted provided that the following conditions are met:
#
#    * Redistributions of source code must retain the above copyright notice,
#      this list of conditions and the following disclaimer.
#    * Redistributions in binary form must reproduce the above copyright notice,
#      this list of conditions and the following disclaimer in the documentation
#      and/or other materials provided with the distribution.
#    * Neither the name of Virtual Cable S.L. nor the names of its contributors
#      may be used to endorse or promote products derived from this software
#      without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
# AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
# DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
# FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
# DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
# SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
# CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
# OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
# OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

'''
@author: Adolfo Gómez, dkmaster at dkmon dot com
'''

from django.utils.translation import ugettext_noop as _
from uds.core.managers.UserPrefsManager import CommonPrefs
from uds.core.ui.UserInterface import gui
from uds.core.transports.BaseTransport import Transport
from uds.core.transports import protocols
from uds.core.util import connection
from uds.core.util.Cache import Cache
from web import generateHtmlForRdp, getHtmlComponent

import logging
import random
import string
import time

logger = logging.getLogger(__name__)

READY_CACHE_TIMEOUT = 30


class TSRDPTransport(Transport):
    '''
    Provides access via RDP to service.
    This transport can use an domain. If username processed by authenticator contains '@', it will split it and left-@-part will be username, and right password
    '''
    typeName = _('RDP Transport (tunneled)')
    typeType = 'TSRDPTransport'
    typeDescription = _('RDP Transport for tunneled connection')
    iconFile = 'rdp.png'
    needsJava = True  # If this transport needs java for rendering
    protocol = protocols.RDP

    tunnelServer = gui.TextField(label=_('Tunnel server'), order=1, tooltip=_('IP or Hostname of tunnel server send to client device ("public" ip) and port. (use HOST:PORT format)'))
    tunnelCheckServer = gui.TextField(label=_('Tunnel host check'), order=2, tooltip=_('If not empty, this server will be used to check if service is running before assigning it to user. (use HOST:PORT format)'))

    useEmptyCreds = gui.CheckBoxField(label=_('Empty creds'), order=3, tooltip=_('If checked, the credentials used to connect will be emtpy'))
    fixedName = gui.TextField(label=_('Username'), order=4, tooltip=_('If not empty, this username will be always used as credential'))
    fixedPassword = gui.PasswordField(label=_('Password'), order=5, tooltip=_('If not empty, this password will be always used as credential'))
    withoutDomain = gui.CheckBoxField(label=_('Without Domain'), order=6, tooltip=_('If checked, the domain part will always be emptied (to connecto to xrdp for example is needed)'))
    fixedDomain = gui.TextField(label=_('Domain'), order=7, tooltip=_('If not empty, this domain will be always used as credential (used as DOMAIN\\user)'))
    allowSmartcards = gui.CheckBoxField(label=_('Allow Smartcards'), order=8, tooltip=_('If checked, this transport will allow the use of smartcards'))
    allowPrinters = gui.CheckBoxField(label=_('Allow Printers'), order=9, tooltip=_('If checked, this transport will allow the use of user printers'))
    allowDrives = gui.CheckBoxField(label=_('Allow Drives'), order=10, tooltip=_('If checked, this transport will allow the use of user drives'))
    allowSerials = gui.CheckBoxField(label=_('Allow Serials'), order=11, tooltip=_('If checked, this transport will allow the use of user serial ports'))
    wallpaper = gui.CheckBoxField(label=_('Show wallpaper'), order=12, tooltip=_('If checked, the wallpaper and themes will be shown on machine (better user experience, more bandwidth)'))

    def __init__(self, environment, values=None):
        super(TSRDPTransport, self).__init__(environment, values)
        if values is not None:
            if values['tunnelServer'].count(':') != 1:
                raise Transport.ValidationException(_('Must use HOST:PORT in Tunnel Server Field'))
            self._tunnelServer = values['tunnelServer']
            self._tunnelCheckServer = values['tunnelCheckServer']
            self._useEmptyCreds = gui.strToBool(values['useEmptyCreds'])
            self._fixedName = values['fixedName']
            self._fixedPassword = values['fixedPassword']
            self._fixedDomain = values['fixedDomain']
            self._allowSmartcards = gui.strToBool(values['allowSmartcards'])
            self._allowPrinters = gui.strToBool(values['allowPrinters'])
            self._allowDrives = gui.strToBool(values['allowDrives'])
            self._allowSerials = gui.strToBool(values['allowSerials'])
            self._wallPaper = gui.strToBool(values['wallpaper'])
            self._withoutDomain = gui.strToBool(values['withoutDomain'])
        else:
            self._tunnelServer = ''
            self._tunnelCheckServer = ''
            self._useEmptyCreds = False
            self._fixedName = ''
            self._fixedPassword = ''
            self._fixedDomain = ''
            self._allowSmartcards = False
            self._allowPrinters = False
            self._allowDrives = False
            self._allowSerials = False
            self._wallPaper = False
            self._withoutDomain = False

    def marshal(self):
        '''
        Serializes the transport data so we can store it in database
        '''
        return str.join('\t', [ 'v3', gui.boolToStr(self._useEmptyCreds), gui.boolToStr(self._allowSmartcards), gui.boolToStr(self._allowPrinters),
                                gui.boolToStr(self._allowDrives), gui.boolToStr(self._allowSerials), gui.boolToStr(self._wallPaper),
                                self._fixedName, self._fixedPassword, self._fixedDomain, self._tunnelServer, self._tunnelCheckServer,
                                gui.boolToStr(self._withoutDomain) ])

    def unmarshal(self, str_):
        data = str_.split('\t')
        if data[0] in ('v1', 'v2', 'v3'):
            self._useEmptyCreds = gui.strToBool(data[1])
            self._allowSmartcards = gui.strToBool(data[2])
            self._allowPrinters = gui.strToBool(data[3])
            self._allowDrives = gui.strToBool(data[4])
            self._allowSerials = gui.strToBool(data[5])
            if data[0] == 'v1':
                self._wallPaper = False
                i = 0

            if data[0] in ('v2', 'v3'):
                self._wallPaper = gui.strToBool(data[6])
                i = 1

            self._fixedName = data[6 + i]
            self._fixedPassword = data[7 + i]
            self._fixedDomain = data[8 + i]
            self._tunnelServer = data[9 + i]
            self._tunnelCheckServer = data[10 + i]

            if data[0] == 'v3':
                self._withoutDomain = gui.strToBool(data[11 + i])

    def valuesDict(self):
        return {
            'allowSmartcards': gui.boolToStr(self._allowSmartcards),
            'allowPrinters': gui.boolToStr(self._allowPrinters),
            'allowDrives': gui.boolToStr(self._allowDrives),
            'allowSerials': gui.boolToStr(self._allowSerials),
            'fixedName': self._fixedName,
            'fixedPassword': self._fixedPassword,
            'fixedDomain': self._fixedDomain,
            'useEmptyCreds': gui.boolToStr(self._useEmptyCreds),
            'tunnelServer': self._tunnelServer,
            'tunnelCheckServer': self._tunnelCheckServer,
            'wallpaper': self._wallPaper,
            'withoutDomain': gui.boolToStr(self._withoutDomain)
        }

    def isAvailableFor(self, ip):
        '''
        Checks if the transport is available for the requested destination ip
        Override this in yours transports
        '''
        logger.debug('Checking availability for {0}'.format(ip))
        ready = self.cache().get(ip)
        if ready is None:
            # Check again for readyness
            if connection.testServer(ip, '3389') == True:
                self.cache().put(ip, 'Y', READY_CACHE_TIMEOUT)
                return True
            else:
                self.cache().put(ip, 'N', READY_CACHE_TIMEOUT)
        return ready == 'Y'

    def renderForHtml(self, userService, idUserService, idTransport, ip, os, user, password):
        # We use helper to keep this clean
        username = user.getUsernameForAuth()
        prefs = user.prefs('rdp')

        if self._fixedName is not '':
            username = self._fixedName

        proc = username.split('@')
        if len(proc) > 1:
            domain = proc[1]
        else:
            domain = ''
        username = proc[0]
        if self._fixedPassword is not '':
            password = self._fixedPassword
        if self._fixedDomain is not '':
            domain = self._fixedDomain;
        if self._useEmptyCreds is True:
            username, password, domain = '', '', ''

        if '.' in domain:  # Dotter domain form
            username = username + '@' + domain
            domain = ''

        if self._withoutDomain is True:
            domain = ''

        width, height = CommonPrefs.getWidthHeight(prefs)
        depth = CommonPrefs.getDepth(prefs)
        cache = Cache('pam')

        tunuser = ''.join(random.choice(string.letters + string.digits) for i in range(12)) + ("%f" % time.time()).split('.')[1]
        tunpass = ''.join(random.choice(string.letters + string.digits) for i in range(12))
        cache.put(tunuser, tunpass, 60 * 10)  # Credential valid for ten minutes, and for 1 use only

        sshHost, sshPort = self._tunnelServer.split(':')

        logger.debug('Username generated: {0}, password: {1}'.format(tunuser, tunpass))
        tun = "{0} {1} {2} {3} {4} {5} {6}".format(tunuser, tunpass, sshHost, sshPort, ip, '3389', '9')
        ip = '127.0.0.1'

        # Extra data
        extra = {
            'width': width,
            'height' : height,
            'depth': depth,
            'printers': self._allowPrinters,
            'smartcards': self._allowSmartcards,
            'drives': self._allowDrives,
            'serials': self._allowSerials,
            'tun': tun,
            'compression': True,
            'wallpaper': self._wallPaper
        }

        # Fix username/password acording to os manager
        username, password = userService.processUserPassword(username, password)

        return generateHtmlForRdp(self, idUserService, idTransport, os, ip, '-1', username, password, domain, extra)

    def getHtmlComponent(self, id, os, componentId):
        # We use helper to keep this clean
        return getHtmlComponent(self.__module__, componentId)
