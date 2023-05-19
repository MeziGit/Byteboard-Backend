const minimum_log_level = "debug"


const pino = require('pino')



const streams = [
    {
        level:"debug",
        stream: process.stdout,
    },
    {
        level:"info",
        stream: pino.destination("./logs/server-log"),
    },
]
const logger =
process.env.CONSOLE_ONLY == "true"
? pino(
    
    {
        level:process.env.PINO_LOG_LEVEL || minimum_log_level,
    })
    
    : pino(

        {
            level:process.env.PINO_LOG_LEVEL || minimum_log_level,
        },

        pino.multistream(streams)
    )

    



module.exports=logger


/*
const transport = pino.transport({

    targets:[
        {
            level:"trace",
            target:"pino/file",

            options:{destination:"logs/server-log"},
        },
        {
            level:"trace",
            target:"pino/file",
        }
    ]
})
*/