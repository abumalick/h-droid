# h-droid (retired)

This was a personal F-Droid repository. It is no longer served: the apps it carried are now
published as GitHub releases and installed and updated with [Obtainium](https://github.com/ImranR98/Obtainium).

In Obtainium, tap Add App and enter the repository URL:

| App | Obtainium source |
|---|---|
| Signal fork (`net.hilson.signal`) | https://github.com/abumalick/Signal-Android (set "Trim version string with RegEx" to `\d+\.\d+\.\d+`) |
| Tabgram (`net.hilson.tabgram`) | https://github.com/abumalick/Tabgram |
| Calendar TZ (`org.fossify.calendar.tz`) | https://github.com/abumalick/fossify-calendar |

Apps installed from this repository keep working and can be updated by Obtainium in place: the
signing keys and application IDs did not change. Remove the old repository from the F-Droid
client (Settings > Repositories > Hilson F-Droid > Delete), since refreshing it now fails.

The code here (fdroidserver config and a Cloudflare Worker serving R2) is kept for reference only.
