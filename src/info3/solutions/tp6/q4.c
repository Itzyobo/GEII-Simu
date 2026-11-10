#include "mcc_generated_files/mcc.h"
#include "LED8x8.h"

int16_t Joy_Cal_X(adc_result_t NumX);
int16_t Joy_Cal_Y(adc_result_t NumY);
int8_t Position(int16_t v);

int16_t ReposX;
int16_t ReposY;

/*
 * TP6 question 4 : carre de 4 LED qui suit le joystick.
 * Origine = LED en bas a droite du carre ; au repos elle est en colonne 5, ligne 5 (en partant d'en haut a gauche).
 * Colonne c (1 a 8, gauche -> droite) = registre Digit 8 - c ; ligne l (1 a 8, haut -> bas) = bit 8 - l.
 */
void main(void)
{
    uint8_t Tab[8];
    int8_t x, y;
    uint8_t col, lig, i;

    SYSTEM_Initialize();
    SPI1_Open(SPI1_DEFAULT);
    LED8x8_Initialize(0);
    LED8x8_Clear();

    ReposX = (int16_t)ADCC_GetSingleConversion(JOY_HORZ);
    ReposY = (int16_t)ADCC_GetSingleConversion(JOY_VERT);

    while (1)
    {
        x = Position(Joy_Cal_X(ADCC_GetSingleConversion(JOY_HORZ)));
        y = Position(Joy_Cal_Y(ADCC_GetSingleConversion(JOY_VERT)));

        col = 5 + x;   // colonne de la LED origine (1 a 8)
        lig = 5 - y;   // ligne de la LED origine (1 a 8)

        for (i = 0; i < 8; i++)
        {
            Tab[i] = 0;
        }
        // (x;y), (x;y+1), (x-1;y), (x-1;y+1)
        Tab[col - 1] = (0x80 >> (lig - 1)) | (0x80 >> (lig - 2));
        Tab[col - 2] = Tab[col - 1];

        for (i = 0; i < 8; i++)
        {
            LED8x8_Write(8 - i, Tab[i]);   // Tab[0] = colonne de gauche = Digit 7
        }
        __delay_ms(50);
    }
}

/* -512..+511 -> -3..+3 : 7 intervalles egaux */
int8_t Position(int16_t v)
{
    if (v < -512) v = -512;
    if (v > 511) v = 511;
    return (int8_t)(((int32_t)v + 512) * 7 / 1024) - 3;
}

int16_t Joy_Cal_X(adc_result_t NumX)
{
    return (int16_t)NumX - ReposX;
}

int16_t Joy_Cal_Y(adc_result_t NumY)
{
    return ReposY - (int16_t)NumY;
}
