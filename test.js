a = {name: "Haamid", id: "male"}
str = JSON.stringify(a)
console.log(str)
b = JSON.parse(str)
console.log(b["id"])