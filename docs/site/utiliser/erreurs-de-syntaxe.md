# Repérer les erreurs de syntaxe

Un raccourci SPIP incomplet peut modifier le rendu du texte. L’éditeur conserve ce passage en
source et signale certaines anomalies par un soulignement ondulé. Leur nombre apparaît sous
l’éditeur.

![Une anomalie de syntaxe soulignée et son explication dans l’éditeur](../medias/erreur_syntaxe.png)

Cliquez sur le compteur pour ouvrir l’anomalie suivante. La fenêtre explique le risque et montre
la source SPIP à corriger. Modifiez-la, puis cliquez sur **Appliquer**.

## Raccourcis signalés

L’éditeur reconnaît notamment :

- une ouverture sans fermeture, comme `{`, `{{` ou `<strong>` ;
- une fermeture sans ouverture, comme `}`, `}}` ou `</quote>` ;
- un intertitre commencé par `{{{` mais incomplet ;
- une citation `<quote>` non fermée ;
- une balise de bloc SPIP non fermée, comme `<multi>`, `<cadre>` ou `<html>`.

Ces erreurs peuvent étendre une mise en forme ou une citation au texte qui suit, ou laisser une
balise sans effet au rendu.

## Limites

Le compteur ne couvre pas tous les raccourcis incomplets : un lien, un modèle, une note ou un
tableau mal formé peut rester en source sans être signalé. Du HTML que l’éditeur ne gère pas,
une entité comme `&nbsp;` ou des accolades vides comme `{}` ne sont pas non plus des anomalies.
Lorsque plusieurs raccourcis imbriqués restent en source, chaque délimiteur peut être compté
séparément.
