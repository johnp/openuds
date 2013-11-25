/* jshint strict: true */
(function(tools, $, undefined) {
    "use strict";
    tools.base64 = function(s) {
        return window.btoa(unescape(encodeURIComponent(s)));
    };
    
    tools.fix3dButtons = function(selector) {
        selector = selector || '';
        selector += ' .btn3d';
        console.log(selector);
        $.each($(selector), function(index, value) {
            var $this = $(this);
            
            var clkEvents = [];
            
            // Store old click events, so we can reconstruct click chain later
            $.each($._data(value, 'events').click, function(index, fnc) {
                clkEvents.push(fnc);
            });
            $this.unbind('click');
            
            /* If Mousedown registers a temporal mouseUp event on parent, to lauch button click */ 
            $this.mousedown(function(event){
                $('body').mouseup(function(e){
                    // Remove temporal mouseup handler
                    $(this).unbind('mouseup');
                    
                    // If movement of mouse is not too far... (16 px maybe well for 3d buttons?)
                    var x = event.pageX - e.pageX, y = event.pageY - e.pageY;
                    var dist_square = x*x + y*y;
                    if( dist_square < 16*16 ) {
                        // Register again old event handlers
                        $.each(clkEvents, function(index, fnc){
                            $this.click(fnc.handler);
                        });
                        $this.click();
                        $this.unbind('click');
                    }
                });
            });
         });
    };
    
    tools.blockUI = function(message) {
        message = message || '<h1><span class="fa fa-spinner fa-spin"></span> ' + gettext('Just a moment...') + '</h1>';
        $.blockUI({ message: message });
    };
    
    tools.unblockUI = function() {
        $.unblockUI();
    };
    
}(api.tools = api.tools || {}, jQuery));


// Insert strftime into tools
//
//strftime
//github.com/samsonjs/strftime
//@_sjs
//
//Copyright 2010 - 2013 Sami Samhuri <sami@samhuri.net>
//
//MIT License
//http://sjs.mit-license.org
//

;(function() {
    "use strict";
    api.tools = api.tools || {};
 
     var namespace = api.tools;
    
     var dayNames = [ gettext('Sunday'), gettext('Monday'), gettext('Tuesday'), gettext('Wednesday'),
             gettext('Thursday'), gettext('Friday'), gettext('Saturday') ];
     var monthNames = [ gettext('January'), gettext('February'), gettext('March'), gettext('April'), gettext('May'),
             gettext('June'), gettext('July'), gettext('August'), gettext('September'), gettext('October'),
             gettext('November'), gettext('December') ];
    
     function initialsOf(arr) {
         var res = [];
         for ( var v in arr) {
             res.push(arr[v].substr(0, 3));
         }
         return res;
     }
    
     var DefaultLocale = {
         days : dayNames,
         shortDays : initialsOf(dayNames),
         months : monthNames,
         shortMonths : initialsOf(monthNames),
         AM : 'AM',
         PM : 'PM',
         am : 'am',
         pm : 'pm',
     };
    
     // Added this to convert django format strings to c format string
     // This is ofc, a "simplified" version, aimed to use date format used by
     // DJANGO
     namespace.djangoFormat = function(format) {
         return format.replace(/./g, function(c) {
             switch (c) {
             case 'a':
             case 'A':
                 return '%p';
             case 'b':
             case 'd':
             case 'm':
             case 'w':
             case 'W':
             case 'y':
             case 'Y':
                 return '%' + c;
             case 'c':
                 return '%FT%TZ';
             case 'D':
                 return '%a';
             case 'e':
                 return '%z';
             case 'f':
                 return '%I:%M';
             case 'F':
                 return '%F';
             case 'h':
             case 'g':
                 return '%I';
             case 'H':
             case 'G':
                 return '%H';
             case 'i':
                 return '%M';
             case 'I':
                 return ''; // daylight saving
             case 'j':
                 return '%d';
             case 'l':
                 return '%A';
             case 'L':
                 return ''; // if it is leap year
             case 'M':
                 return '%b';
             case 'n':
                 return '%m';
             case 'N':
                 return '%b';
             case 'o':
                 return '%W'; // Not so sure, not important i thing anyway :-)
             case 'O':
                 return '%z';
             case 'P':
                 return '%R %p';
             case 'r':
                 return '%a, %d %b %Y %T %z';
             case 's':
                 return '%S';
             case 'S':
                 return ''; // english ordinal suffix for day of month
             case 't':
                 return ''; // number of days of specified month, not important
             case 'T':
                 return '%Z';
             case 'u':
                 return '0'; // microseconds
             case 'U':
                 return ''; // Seconds since EPOCH, not used
             case 'z':
                 return '%j';
             case 'Z':
                 return 'z'; // Time zone offset in seconds, replaced by offset
                             // in ours/minutes :-)
             default:
                 return c;
             }
    
         });
     };
    
     namespace.strftime = strftime;
     function strftime(fmt, d, locale) {
         return _strftime(fmt, d, locale);
     }
    
     // locale is optional
     namespace.strftimeTZ = strftime.strftimeTZ = strftimeTZ;
     function strftimeTZ(fmt, d, locale, timezone) {
         if (typeof locale == 'number' && timezone === null) {
             timezone = locale;
             locale = undefined;
         }
         return _strftime(fmt, d, locale, {
             timezone : timezone
         });
     }
    
     namespace.strftimeUTC = strftime.strftimeUTC = strftimeUTC;
     function strftimeUTC(fmt, d, locale) {
         return _strftime(fmt, d, locale, {
             utc : true
         });
     }
    
     namespace.localizedStrftime = strftime.localizedStrftime = localizedStrftime;
     function localizedStrftime(locale) {
         return function(fmt, d, options) {
             return strftime(fmt, d, locale, options);
         };
     }
    
     // d, locale, and options are optional, but you can't leave
     // holes in the argument list. If you pass options you have to pass
     // in all the preceding args as well.
     //
     // options:
     // - locale [object] an object with the same structure as DefaultLocale
     // - timezone [number] timezone offset in minutes from GMT
     function _strftime(fmt, d, locale, options) {
         options = options || {};
    
         // d and locale are optional so check if d is really the locale
         if (d && !quacksLikeDate(d)) {
             locale = d;
             d = undefined;
         }
         d = d || new Date();
    
         locale = locale || DefaultLocale;
         locale.formats = locale.formats || {};
    
         // Hang on to this Unix timestamp because we might mess with it directly
         // below.
         var timestamp = d.getTime();
    
         if (options.utc || typeof options.timezone == 'number') {
             d = dateToUTC(d);
         }
    
         if (typeof options.timezone == 'number') {
             d = new Date(d.getTime() + (options.timezone * 60000));
         }
    
         // Most of the specifiers supported by C's strftime, and some from Ruby.
         // Some other syntax extensions from Ruby are supported: %-, %_, and %0
         // to pad with nothing, space, or zero (respectively).
         return fmt.replace(/%([-_0]?.)/g, function(_, c) {
             var mod, padding;
             if (c.length == 2) {
                 mod = c[0];
                 // omit padding
                 if (mod == '-') {
                     padding = '';
                 }
                 // pad with space
                 else if (mod == '_') {
                     padding = ' ';
                 }
                 // pad with zero
                 else if (mod == '0') {
                     padding = '0';
                 } else {
                     // unrecognized, return the format
                     return _;
                 }
                 c = c[1];
             }
             switch (c) {
             case 'A':
                 return locale.days[d.getDay()];
             case 'a':
                 return locale.shortDays[d.getDay()];
             case 'B':
                 return locale.months[d.getMonth()];
             case 'b':
                 return locale.shortMonths[d.getMonth()];
             case 'C':
                 return pad(Math.floor(d.getFullYear() / 100), padding);
             case 'D':
                 return _strftime(locale.formats.D || '%m/%d/%y', d, locale);
             case 'd':
                 return pad(d.getDate(), padding);
             case 'e':
                 return d.getDate();
             case 'F':
                 return _strftime(locale.formats.F || '%Y-%m-%d', d, locale);
             case 'H':
                 return pad(d.getHours(), padding);
             case 'h':
                 return locale.shortMonths[d.getMonth()];
             case 'I':
                 return pad(hours12(d), padding);
             case 'j':
                 var y = new Date(d.getFullYear(), 0, 1);
                 var day = Math.ceil((d.getTime() - y.getTime()) / (1000 * 60 * 60 * 24));
                 return pad(day, 3);
             case 'k':
                 return pad(d.getHours(), padding === null ? ' ' : padding);
             case 'L':
                 return pad(Math.floor(timestamp % 1000), 3);
             case 'l':
                 return pad(hours12(d), padding === null ? ' ' : padding);
             case 'M':
                 return pad(d.getMinutes(), padding);
             case 'm':
                 return pad(d.getMonth() + 1, padding);
             case 'n':
                 return '\n';
             case 'o':
                 return String(d.getDate()) + ordinal(d.getDate());
             case 'P':
                 return d.getHours() < 12 ? locale.am : locale.pm;
             case 'p':
                 return d.getHours() < 12 ? locale.AM : locale.PM;
             case 'R':
                 return _strftime(locale.formats.R || '%H:%M', d, locale);
             case 'r':
                 return _strftime(locale.formats.r || '%I:%M:%S %p', d, locale);
             case 'S':
                 return pad(d.getSeconds(), padding);
             case 's':
                 return Math.floor(timestamp / 1000);
             case 'T':
                 return _strftime(locale.formats.T || '%H:%M:%S', d, locale);
             case 't':
                 return '\t';
             case 'U':
                 return pad(weekNumber(d, 'sunday'), padding);
             case 'u':
                 var dayu = d.getDay();
                 return dayu === 0 ? 7 : dayu; // 1 - 7, Monday is first day of the
                 // week
             case 'v':
                 return _strftime(locale.formats.v || '%e-%b-%Y', d, locale);
             case 'W':
                 return pad(weekNumber(d, 'monday'), padding);
             case 'w':
                 return d.getDay(); // 0 - 6, Sunday is first day of the
                 // week
             case 'Y':
                 return d.getFullYear();
             case 'y':
                 var yy = String(d.getFullYear());
                 return yy.slice(yy.length - 2);
             case 'Z':
                 if (options.utc) {
                     return "GMT";
                 } else {
                     var tz = d.toString().match(/\((\w+)\)/);
                     return tz && tz[1] || '';
                 }
                 break;
             case 'z':
                 if (options.utc) {
                     return "+0000";
                 } else {
                     var off = typeof options.timezone == 'number' ? options.timezone : -d.getTimezoneOffset();
                     return (off < 0 ? '-' : '+') + pad(Math.abs(off / 60)) + pad(off % 60);
                 }
                 break;
             default:
                 return c;
             }
         });
     }
    
     function dateToUTC(d) {
         var msDelta = (d.getTimezoneOffset() || 0) * 60000;
         return new Date(d.getTime() + msDelta);
     }
    
     var RequiredDateMethods = [ 'getTime', 'getTimezoneOffset', 'getDay', 'getDate', 'getMonth', 'getFullYear',
             'getYear', 'getHours', 'getMinutes', 'getSeconds' ];
     function quacksLikeDate(x) {
         var i = 0, n = RequiredDateMethods.length;
         for (i = 0; i < n; ++i) {
             if (typeof x[RequiredDateMethods[i]] != 'function') {
                 return false;
             }
         }
         return true;
     }
    
     // Default padding is '0' and default length is 2, both are optional.
     function pad(n, padding, length) {
         // pad(n, <length>)
         if (typeof padding === 'number') {
             length = padding;
             padding = '0';
         }
    
         // Defaults handle pad(n) and pad(n, <padding>)
         if (padding === null) {
             padding = '0';
         }
         length = length || 2;
    
         var s = String(n);
         // padding may be an empty string, don't loop forever if it is
         if (padding) {
             while (s.length < length)
                 s = padding + s;
         }
         return s;
     }
    
     function hours12(d) {
         var hour = d.getHours();
         if (hour === 0)
             hour = 12;
         else if (hour > 12)
             hour -= 12;
         return hour;
     }
    
     // Get the ordinal suffix for a number: st, nd, rd, or th
     function ordinal(n) {
         var i = n % 10, ii = n % 100;
         if ((ii >= 11 && ii <= 13) || i === 0 || i >= 4) {
             return 'th';
         }
         switch (i) {
         case 1:
             return 'st';
         case 2:
             return 'nd';
         case 3:
             return 'rd';
         }
     }
    
     // firstWeekday: 'sunday' or 'monday', default is 'sunday'
     //
     // Pilfered & ported from Ruby's strftime implementation.
     function weekNumber(d, firstWeekday) {
         firstWeekday = firstWeekday || 'sunday';
    
         // This works by shifting the weekday back by one day if we
         // are treating Monday as the first day of the week.
         var wday = d.getDay();
         if (firstWeekday == 'monday') {
             if (wday === 0) // Sunday
                 wday = 6;
             else
                 wday--;
         }
         var firstDayOfYear = new Date(d.getFullYear(), 0, 1), yday = (d - firstDayOfYear) / 86400000, weekNum = (yday + 7 - wday) / 7;
         return Math.floor(weekNum);
     }

}());